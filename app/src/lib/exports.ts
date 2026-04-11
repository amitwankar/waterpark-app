/**
 * Server-side export helpers — streamed Response objects.
 * Import ONLY in route handlers (server-only).
 */

export interface ExportColumn {
  key: string;
  header: string;
  width?: number; // Excel column width
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function exportToCSV(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string
): Response {
  const headers = columns.map((c) => `"${c.header}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        const str = val === null || val === undefined ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csv = [headers, ...rows].join("\r\n");
  const bom = "\uFEFF"; // UTF-8 BOM for Excel

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export async function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  sheetName: string,
  filename: string
): Promise<Response> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  // Header row — teal background, bold white text
  sheet.columns = columns.map((c) => ({
    key: c.key,
    header: c.header,
    width: c.width ?? 20,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F766E" }, // teal-700
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // Data rows with alternating background
  data.forEach((row, idx) => {
    const sheetRow = sheet.addRow(row);
    if (idx % 2 === 1) {
      sheetRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0FDFA" }, // teal-50
        };
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function exportToPDF(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  title: string,
  filename: string
): Promise<Response> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape" });

  // Park header
  doc.setFontSize(18);
  doc.setTextColor(15, 118, 110); // teal-700
  doc.text("Waterpark Management", 14, 16);

  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text(title, 14, 24);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 30);

  autoTable(doc, {
    startY: 35,
    head: [columns.map((c) => c.header)],
    body: data.map((row) =>
      columns.map((c) => {
        const val = row[c.key];
        return val === null || val === undefined ? "" : String(val);
      })
    ),
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [240, 253, 250] },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { top: 35, left: 14, right: 14 },
  });

  const pdfBytes = doc.output("arraybuffer");

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
    },
  });
}
