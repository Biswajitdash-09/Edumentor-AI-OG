import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

const routeNames: Record<string, string> = {
  "/": "Dashboard",
  "/courses": "Courses",
  "/attendance": "Attendance",
  "/ai-mentor": "AI Mentor",
  "/assignment-submission": "Submit Assignment",
  "/grade-submissions": "Grade Submissions",
  "/attendance-analytics": "Attendance Analytics",
  "/announcements": "Announcements",
  "/schedule": "Schedule",
  "/analytics": "Analytics",
  "/profile": "Profile",
  "/grades": "Grades",
  "/dashboard/student": "Student Dashboard",
  "/dashboard/faculty": "Faculty Dashboard",
  "/dashboard/admin": "Admin Dashboard",
  "/dashboard/parent": "Parent Dashboard",
};

// UUID regex pattern to detect dynamic IDs
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Get friendly name for path segment
const getFriendlyName = (segment: string, pathnames: string[], index: number): string => {
  // Check if this is a UUID
  if (uuidPattern.test(segment)) {
    // Determine context based on previous path segment
    const prevSegment = index > 0 ? pathnames[index - 1] : null;
    
    if (prevSegment === "courses") {
      return "Course Details";
    }
    if (prevSegment === "assignments") {
      return "Assignment";
    }
    if (prevSegment === "attendance") {
      return "Session Details";
    }
    if (prevSegment === "students") {
      return "Student Progress";
    }
    
    // Generic fallback for UUIDs
    return "Details";
  }
  
  // Capitalize and format the segment
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  // Don't show breadcrumbs on home page
  if (location.pathname === "/") {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4 overflow-x-auto">
      <Link
        to="/"
        className="flex items-center hover:text-foreground transition-colors flex-shrink-0"
      >
        <Home className="w-4 h-4" />
      </Link>
      
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;
        const isLast = index === pathnames.length - 1;
        const routeName = routeNames[to] || getFriendlyName(value, pathnames, index);

        return (
          <div key={to} className="flex items-center space-x-2 flex-shrink-0">
            <ChevronRight className="w-4 h-4" />
            {isLast ? (
              <span className="text-foreground font-medium truncate max-w-[150px] sm:max-w-none">{routeName}</span>
            ) : (
              <Link
                to={to}
                className="hover:text-foreground transition-colors truncate max-w-[100px] sm:max-w-none"
              >
                {routeName}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
};
