"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BadgePrintButtonProps {
  guest: {
    fullName: string;
    salutation?: string | null;
    company: string;
    designation: string;
    category: string;
    plusOneName?: string | null;  // comma-joined list or undefined
  };
  eventName?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  VIP:     { bg: "#fef9c3", text: "#854d0e" },
  MEDIA:   { bg: "#dbeafe", text: "#1e40af" },
  SPONSOR: { bg: "#ede9fe", text: "#5b21b6" },
  SPEAKER: { bg: "#dcfce7", text: "#166534" },
  GENERAL: { bg: "#f3f4f6", text: "#374151" },
};

export function BadgePrintButton({ guest, eventName }: BadgePrintButtonProps) {
  function handlePrint() {
    const colors = CATEGORY_COLORS[guest.category] ?? CATEGORY_COLORS.GENERAL;
    const displayName = [guest.salutation, guest.fullName].filter(Boolean).join(" ");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Badge — ${displayName}</title>
  <style>
    @page { size: 3.5in 2in; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
    .badge {
      width: 3.5in; height: 2in;
      border: 2px solid ${colors.text};
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: ${colors.bg};
      color: ${colors.text};
      font-size: 9pt;
      font-weight: bold;
      text-align: center;
      padding: 4px 8px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      text-align: center;
    }
    .event-name {
      font-size: 7pt;
      color: #6b7280;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .name { font-size: 18pt; font-weight: bold; color: #111; line-height: 1.15; }
    .designation { font-size: 9pt; color: #374151; margin-top: 3px; }
    .company { font-size: 9pt; color: #6b7280; margin-top: 1px; }
    .plusone { font-size: 7.5pt; color: #6b7280; margin-top: 5px; border-top: 1px dashed #d1d5db; padding-top: 4px; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="badge">
    <div class="header">${guest.category}</div>
    <div class="body">
      ${eventName ? `<p class="event-name">${eventName}</p>` : ""}
      <p class="name">${displayName}</p>
      ${guest.designation ? `<p class="designation">${guest.designation}</p>` : ""}
      ${guest.company ? `<p class="company">${guest.company}</p>` : ""}
      ${guest.plusOneName ? `<p class="plusone">+1 ${guest.plusOneName}</p>` : ""}
    </div>
  </div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=420,height=320");
    if (!win) {
      alert("Pop-up blocked. Please allow pop-ups for badge printing.");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  return (
    <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 gap-1.5">
      <Printer className="h-3.5 w-3.5" />
      Print Badge
    </Button>
  );
}
