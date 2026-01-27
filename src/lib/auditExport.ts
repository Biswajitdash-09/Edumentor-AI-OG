import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_name?: string;
  action: string;
  entity_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

const formatValue = (value: Record<string, unknown> | null): string => {
  if (!value) return "-";
  return Object.entries(value)
    .map(([key, val]) => `${key}: ${val}`)
    .join(", ");
};

export const exportAuditLogsToPDF = (logs: AuditLog[], filename: string = "audit-logs") => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text("Audit Logs Report", 14, 22);
  doc.setFontSize(10);
  doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, 14, 30);

  const tableData = logs.map((log) => [
    format(new Date(log.created_at), "MMM d, yyyy HH:mm"),
    log.user_name || "Unknown",
    log.action.replace("_", " "),
    log.entity_type,
    formatValue(log.old_value),
    formatValue(log.new_value),
  ]);

  autoTable(doc, {
    head: [["Timestamp", "User", "Action", "Entity", "Old Value", "New Value"]],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20 },
      4: { cellWidth: 40 },
      5: { cellWidth: 40 },
    },
  });

  doc.save(`${filename}.pdf`);
};

export const exportAuditLogsToExcel = (logs: AuditLog[], filename: string = "audit-logs") => {
  const data = logs.map((log) => ({
    Timestamp: format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
    User: log.user_name || "Unknown",
    Action: log.action.replace("_", " "),
    Entity: log.entity_type,
    "Old Value": formatValue(log.old_value),
    "New Value": formatValue(log.new_value),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};
