"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Upload, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkImportProps {
  eventId: string;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

export function BulkImport({ eventId }: BulkImportProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors([]);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/events/${eventId}/guests/bulk`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Import failed");
      }

      toast.success(`Imported ${data.successCount} guests (${data.errorCount} errors)`);

      if (data.errorDetails?.length) {
        setErrors(data.errorDetails);
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const headers = [
      "fullName",
      "email",
      "mobile",
      "designation",
      "company",
      "salutation",
      "category",
      "plusOneNames",
      "dietaryPreference",
      "invitationMethod",
    ];
    const example = [
      "Juan Dela Cruz",
      "juan@example.com",
      "+63 917 123 4567",
      "CEO",
      "Acme Corp",
      "MR",
      "GENERAL",
      "",
      "",
      "EMAIL",
    ];

    const csvContent = [headers.join(","), example.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "guest-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {loading ? "Importing..." : "Import CSV / Excel"}
        </Button>
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">{errors.length} import error(s):</p>
            <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {errors.map((e, i) => (
                <li key={i}>
                  Row {e.row}: <strong>{e.field}</strong> — {e.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
