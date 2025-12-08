/**
 * CSV Export Utilities
 */

type CSVData = Record<string, string | number | boolean | null | undefined>;

export function exportToCSV(data: CSVData[], filename: string, columns?: { key: string; header: string }[]) {
  if (data.length === 0) {
    return;
  }

  // Determine columns
  const cols = columns || Object.keys(data[0]).map(key => ({ key, header: key }));
  
  // Create CSV header
  const header = cols.map(col => `"${col.header}"`).join(",");
  
  // Create CSV rows
  const rows = data.map(row => {
    return cols.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) {
        return '""';
      }
      // Escape quotes and wrap in quotes
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(",");
  });

  // Combine header and rows
  const csv = [header, ...rows].join("\n");

  // Create blob and download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatDateForCSV(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

export function formatTimeForCSV(time: string): string {
  return time;
}
