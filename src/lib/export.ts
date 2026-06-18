import ExcelJS from "exceljs";

export interface ExportColumn<T> {
  header: string;
  width?: number;
  /** Excel number format, e.g. "0", "0.0". Omit for text. */
  numFmt?: string;
  value: (row: T) => string | number | Date | null | undefined;
}

/**
 * Genera y descarga un archivo Excel (.xlsx) real con encabezados en negrita,
 * anchos de columna y formatos numéricos. Usa ExcelJS (soporta estilos al escribir,
 * a diferencia de SheetJS community).
 */
export async function exportToXlsx<T>(opts: {
  filename: string;
  sheetName?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}): Promise<void> {
  const { filename, sheetName = "Datos", columns, rows } = opts;

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName);

  ws.columns = columns.map((c, i) => ({
    header: c.header,
    key: String(i),
    width: c.width ?? 18,
    style: c.numFmt ? { numFmt: c.numFmt } : undefined,
  }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };

  rows.forEach((row) => {
    const record: Record<string, string | number | Date | null | undefined> = {};
    columns.forEach((c, i) => {
      const v = c.value(row);
      record[String(i)] = v === null || v === undefined ? "" : v;
    });
    ws.addRow(record);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
