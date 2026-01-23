import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface StudentAnalyticsData {
  studentName: string;
  averageGrade: number;
  attendanceRate: number;
  completedAssignments: number;
  totalAssignments: number;
  enrolledCourses: number;
}

interface AttendanceTrendData {
  week: string;
  attendance: number;
  classAverage: number;
}

interface CoursePerformanceData {
  course: string;
  grade: number;
  attendance: number;
  submissions: number;
}

interface GradeProgressionData {
  semester: string;
  gpa: number;
  courses: number;
}

interface AssignmentStatusData {
  status: string;
  count: number;
}

export function exportStudentAnalyticsPDF(
  data: {
    student: StudentAnalyticsData;
    attendanceTrends: AttendanceTrendData[];
    coursePerformance: CoursePerformanceData[];
    gradeProgression: GradeProgressionData[];
    assignmentStats: AssignmentStatusData[];
  }
) {
  const doc = new jsPDF();
  const { student, attendanceTrends, coursePerformance, gradeProgression, assignmentStats } = data;
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(124, 58, 237);
  doc.text("EduMentor AI", 14, 20);
  
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("My Academic Report", 14, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Student: ${student.studentName}`, 14, 42);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 48);
  
  // Summary Section
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Performance Summary", 14, 62);
  
  doc.setFontSize(10);
  doc.text(`Average Grade: ${student.averageGrade}%`, 14, 72);
  doc.text(`Attendance Rate: ${student.attendanceRate}%`, 14, 78);
  doc.text(`Assignments Completed: ${student.completedAssignments}/${student.totalAssignments}`, 14, 84);
  doc.text(`Enrolled Courses: ${student.enrolledCourses}`, 14, 90);
  
  // Assignment Status
  doc.setFontSize(12);
  doc.text("Assignment Status", 120, 62);
  doc.setFontSize(10);
  let yOffset = 72;
  assignmentStats.forEach((stat) => {
    doc.text(`${stat.status}: ${stat.count}`, 120, yOffset);
    yOffset += 6;
  });
  
  // Attendance Trends Table
  if (attendanceTrends.length > 0) {
    autoTable(doc, {
      startY: 100,
      head: [["Week", "Your Attendance", "Class Average"]],
      body: attendanceTrends.map((t) => [
        t.week,
        `${t.attendance}%`,
        `${t.classAverage}%`,
      ]),
      headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      styles: { fontSize: 9 },
      margin: { left: 14 },
    });
  }
  
  // Course Performance Table
  if (coursePerformance.length > 0) {
    const lastY = (doc as any).lastAutoTable?.finalY || 150;
    
    doc.setFontSize(12);
    doc.text("Course Performance", 14, lastY + 15);
    
    autoTable(doc, {
      startY: lastY + 20,
      head: [["Course", "Grade", "Attendance", "Submissions"]],
      body: coursePerformance.map((c) => [
        c.course,
        `${c.grade}%`,
        `${c.attendance}%`,
        c.submissions.toString(),
      ]),
      headStyles: { fillColor: [124, 58, 237] },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      styles: { fontSize: 9 },
      margin: { left: 14 },
    });
  }
  
  // Grade Progression Table (new page if needed)
  if (gradeProgression.length > 0) {
    const lastY = (doc as any).lastAutoTable?.finalY || 200;
    
    if (lastY > 230) {
      doc.addPage();
      doc.setFontSize(12);
      doc.text("Grade Progression by Semester", 14, 20);
      
      autoTable(doc, {
        startY: 25,
        head: [["Semester", "GPA (10-point scale)", "Courses"]],
        body: gradeProgression.map((g) => [
          g.semester,
          g.gpa.toFixed(1),
          g.courses.toString(),
        ]),
        headStyles: { fillColor: [124, 58, 237] },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        styles: { fontSize: 9 },
        margin: { left: 14 },
      });
    } else {
      doc.setFontSize(12);
      doc.text("Grade Progression by Semester", 14, lastY + 15);
      
      autoTable(doc, {
        startY: lastY + 20,
        head: [["Semester", "GPA (10-point scale)", "Courses"]],
        body: gradeProgression.map((g) => [
          g.semester,
          g.gpa.toFixed(1),
          g.courses.toString(),
        ]),
        headStyles: { fillColor: [124, 58, 237] },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        styles: { fontSize: 9 },
        margin: { left: 14 },
      });
    }
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} | EduMentor AI - My Academic Report`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }
  
  doc.save(`My_Academic_Report_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function exportStudentAnalyticsExcel(
  data: {
    student: StudentAnalyticsData;
    attendanceTrends: AttendanceTrendData[];
    coursePerformance: CoursePerformanceData[];
    gradeProgression: GradeProgressionData[];
    assignmentStats: AssignmentStatusData[];
  }
) {
  const workbook = XLSX.utils.book_new();
  const { student, attendanceTrends, coursePerformance, gradeProgression, assignmentStats } = data;
  
  // Summary sheet
  const summaryData = [
    ["EduMentor AI - My Academic Report"],
    [""],
    ["Student", student.studentName],
    ["Generated", new Date().toLocaleDateString()],
    [""],
    ["Performance Summary"],
    ["Average Grade", `${student.averageGrade}%`],
    ["Attendance Rate", `${student.attendanceRate}%`],
    ["Assignments Completed", `${student.completedAssignments}/${student.totalAssignments}`],
    ["Enrolled Courses", student.enrolledCourses],
    [""],
    ["Assignment Status"],
    ...assignmentStats.map((s) => [s.status, s.count]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  
  // Attendance Trends sheet
  if (attendanceTrends.length > 0) {
    const attendanceData = [
      ["Week", "Your Attendance", "Class Average"],
      ...attendanceTrends.map((t) => [t.week, `${t.attendance}%`, `${t.classAverage}%`]),
    ];
    const attendanceSheet = XLSX.utils.aoa_to_sheet(attendanceData);
    XLSX.utils.book_append_sheet(workbook, attendanceSheet, "Attendance Trends");
  }
  
  // Course Performance sheet
  if (coursePerformance.length > 0) {
    const courseData = [
      ["Course", "Grade", "Attendance", "Submissions"],
      ...coursePerformance.map((c) => [c.course, `${c.grade}%`, `${c.attendance}%`, c.submissions]),
    ];
    const courseSheet = XLSX.utils.aoa_to_sheet(courseData);
    XLSX.utils.book_append_sheet(workbook, courseSheet, "Course Performance");
  }
  
  // Grade Progression sheet
  if (gradeProgression.length > 0) {
    const gradeData = [
      ["Semester", "GPA (10-point scale)", "Number of Courses"],
      ...gradeProgression.map((g) => [g.semester, g.gpa.toFixed(1), g.courses]),
    ];
    const gradeSheet = XLSX.utils.aoa_to_sheet(gradeData);
    XLSX.utils.book_append_sheet(workbook, gradeSheet, "Grade Progression");
  }
  
  XLSX.writeFile(workbook, `My_Academic_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
}
