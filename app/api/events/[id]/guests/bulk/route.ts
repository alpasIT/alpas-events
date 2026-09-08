import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { generateToken } from "@/lib/utils";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { guestSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin(["SUPER_ADMIN", "EVENT_COORDINATOR"]);
  if (auth.response) return auth.response;

  const { id: eventId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let rows: Record<string, string>[] = [];

    if (fileName.endsWith(".csv")) {
      const text = buffer.toString("utf-8");
      const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      rows = result.data;
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);
    } else {
      return NextResponse.json({ error: "Unsupported file type. Use CSV or Excel." }, { status: 400 });
    }

    const job = await prisma.bulkImportJob.create({
      data: {
        eventId,
        fileName: file.name,
        totalRows: rows.length,
        status: "PROCESSING",
      },
    });

    let successCount = 0;
    const errorDetails: Array<{ row: number; field: string; message: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-based + header row

      const parsed = guestSchema.safeParse({
        fullName: row.fullName ?? row["Full Name"] ?? "",
        email: row.email ?? row.Email ?? "",
        mobile: row.mobile ?? row.Mobile ?? row.Phone ?? "",
        designation: row.designation ?? row.Designation ?? "",
        company: row.company ?? row.Company ?? "",
        salutation: row.salutation ?? row.Salutation ?? undefined,
        category: row.category ?? row.Category ?? "GENERAL",
        plusOneNames: (() => {
          const raw = row.plusOneNames ?? row.plusOneName ?? row["Plus One"] ?? "";
          return raw ? String(raw).split(",").map((s: string) => s.trim()).filter(Boolean) : undefined;
        })(),
        dietaryPreference: row.dietaryPreference ?? row["Dietary Preference"] ?? undefined,
        invitationMethod: row.invitationMethod ?? row["Invitation Method"] ?? "EMAIL",
      });

      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
        const firstField = Object.keys(fieldErrors)[0];
        errorDetails.push({
          row: rowNum,
          field: firstField,
          message: fieldErrors[firstField]?.[0] ?? "Validation error",
        });
        continue;
      }

      try {
        const qrToken = generateToken(24);
        const { plusOneNames, ...guestData } = parsed.data;
        await prisma.guest.create({
          data: {
            ...guestData,
            eventId,
            qrToken,
            ...(plusOneNames && plusOneNames.length > 0
              ? { plusOnes: { create: plusOneNames.map((name) => ({ name })) } }
              : {}),
          },
        });
        successCount++;
      } catch (err) {
        const message = err instanceof Error && err.message.includes("Unique") 
          ? "Duplicate email" 
          : "Database error";
        errorDetails.push({ row: rowNum, field: "email", message });
      }
    }

    await prisma.bulkImportJob.update({
      where: { id: job.id },
      data: {
        successCount,
        errorCount: errorDetails.length,
        errorDetails,
        status: "DONE",
        processedAt: new Date(),
      },
    });

    await prisma.activityLog.create({
      data: {
        eventId,
        type: "BULK_IMPORT",
        description: `Bulk import: ${successCount} guests added, ${errorDetails.length} errors`,
        adminId: auth.admin.id,
      },
    });

    return NextResponse.json({ successCount, errorCount: errorDetails.length, errorDetails });
  } catch {
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
