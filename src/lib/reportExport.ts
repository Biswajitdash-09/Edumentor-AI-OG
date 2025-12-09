import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface StudentData {
  name: string;
  email?: string;
  attendanceRate: number;
  avgGrade: number;
  riskLevel?: string;
}

interface AttendanceRecord {
  studentName: string;
  date: string;
  status: string;
  courseName: string;
}

interface GradeRecord {
  studentName: string;
  assignmentTitle: string;
  grade: number;
  maxPoints: number;
  percentage: number;
  courseName: string;
}

// Export student performance report as PDF
export function exportStudentReportPDF(
  students: StudentData[],
  courseName: string,
  dateRange: { start: string; end: string }
) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(124, 58, 237); // Primary purple
  doc.text("EduMentor AI", 14, 20);
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Student Performance Report", 14, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Course: ${courseName}`, 14, 42);
  doc.text(`Date Range: ${dateRange.start} to ${dateRange.end}`, 14, 48);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 54);
  
  // Summary stats
  const avgAttendance = students.reduce((sum, s) => sum + s.attendanceRate, 0) / students.length;
  const avgGrade = students.reduce((sum, s) => sum + s.avgGrade, 0) / students.length;
  const atRiskCount = students.filter(s => s.riskLevel === "high" || s.riskLevel === "medium").length;
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Summary", 14, 68);
  
  doc.setFontSize(10);
  doc.text(`Total Students: ${students.length}`, 14, 76);
  doc.text(`Average Attendance: ${avgAttendance.toFixed(1)}%`, 14, 82);
  doc.text(`Average Grade: ${avgGrade.toFixed(1)}%`, 14, 88);
  doc.text(`At-Risk Students: ${atRiskCount}`, 14, 94);
  
  // Student table
  autoTable(doc, {
    startY: 105,
    head: [["Student Name", "Attendance", "Avg Grade", "Risk Level"]],
    body: students.map(s => [
      s.name,
      `${s.attendanceRate}%`,
      `${s.avgGrade}%`,
      s.riskLevel || "N/A"
    ]),
    headStyles: { fillColor: [124, 58, 237] },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    styles: { fontSize: 9 },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} | EduMentor AI`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }
  
  doc.save(`Student_Report_${courseName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

// Export attendance records as PDF
export function exportAttendancePDF(
  records: AttendanceRecord[],
  courseName: string,
  dateRange: { start: string; end: string }
) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(124, 58, 237);
  doc.text("EduMentor AI", 14, 20);
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Attendance Report", 14, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Course: ${courseName}`, 14, 42);
  doc.text(`Date Range: ${dateRange.start} to ${dateRange.end}`, 14, 48);
  doc.text(`Total Records: ${records.length}`, 14, 54);
  
  autoTable(doc, {
    startY: 65,
    head: [["Student", "Date", "Status", "Course"]],
    body: records.map(r => [r.studentName, r.date, r.status, r.courseName]),
    headStyles: { fillColor: [124, 58, 237] },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    styles: { fontSize: 9 },
  });
  
  doc.save(`Attendance_Report_${new Date().toISOString().split("T")[0]}.pdf`);
}

// Export grades as PDF
export function exportGradesPDF(
  records: GradeRecord[],
  courseName: string
) {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(124, 58, 237);
  doc.text("EduMentor AI", 14, 20);
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Grade Report", 14, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Course: ${courseName}`, 14, 42);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 48);
  
  autoTable(doc, {
    startY: 60,
    head: [["Student", "Assignment", "Grade", "Max Points", "Percentage"]],
    body: records.map(r => [
      r.studentName,
      r.assignmentTitle,
      r.grade.toString(),
      r.maxPoints.toString(),
      `${r.percentage.toFixed(1)}%`
    ]),
    headStyles: { fillColor: [124, 58, 237] },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    styles: { fontSize: 9 },
  });
  
  doc.save(`Grade_Report_${courseName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

// Export student data as Excel
export function exportStudentReportExcel(
  students: StudentData[],
  courseName: string,
  dateRange: { start: string; end: string }
) {
  const workbook = XLSX.utils.book_new();
  
  // Summary sheet
  const summaryData = [
    ["EduMentor AI - Student Performance Report"],
    [""],
    ["Course", courseName],
    ["Date Range", `${dateRange.start} to ${dateRange.end}`],
    ["Generated", new Date().toLocaleDateString()],
    [""],
    ["Total Students", students.length],
    ["Average Attendance", `${(students.reduce((s, st) => s + st.attendanceRate, 0) / students.length).toFixed(1)}%`],
    ["Average Grade", `${(students.reduce((s, st) => s + st.avgGrade, 0) / students.length).toFixed(1)}%`],
    ["At-Risk Students", students.filter(s => s.riskLevel === "high" || s.riskLevel === "medium").length],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  
  // Students sheet
  const studentData = [
    ["Student Name", "Email", "Attendance Rate", "Average Grade", "Risk Level"],
    ...students.map(s => [s.name, s.email || "", `${s.attendanceRate}%`, `${s.avgGrade}%`, s.riskLevel || "N/A"])
  ];
  const studentsSheet = XLSX.utils.aoa_to_sheet(studentData);
  XLSX.utils.book_append_sheet(workbook, studentsSheet, "Students");
  
  XLSX.writeFile(workbook, `Student_Report_${courseName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// Export attendance as Excel
export function exportAttendanceExcel(
  records: AttendanceRecord[],
  courseName: string
) {
  const workbook = XLSX.utils.book_new();
  
  const data = [
    ["Student", "Date", "Status", "Course"],
    ...records.map(r => [r.studentName, r.date, r.status, r.courseName])
  ];
  
  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
  
  XLSX.writeFile(workbook, `Attendance_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// Export grades as Excel
export function exportGradesExcel(
  records: GradeRecord[],
  courseName: string
) {
  const workbook = XLSX.utils.book_new();
  
  const data = [
    ["Student", "Assignment", "Grade", "Max Points", "Percentage", "Course"],
    ...records.map(r => [r.studentName, r.assignmentTitle, r.grade, r.maxPoints, `${r.percentage.toFixed(1)}%`, r.courseName])
  ];
  
  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, "Grades");
  
  XLSX.writeFile(workbook, `Grade_Report_${courseName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
}