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
  "/dashboard/student": "Student Dashboard",
  "/dashboard/faculty": "Faculty Dashboard",
  "/dashboard/admin": "Admin Dashboard",
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  // Don't show breadcrumbs on home page
  if (location.pathname === "/") {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
      <Link
        to="/"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join("/")}`;
        const isLast = index === pathnames.length - 1;
        const routeName = routeNames[to] || value.charAt(0).toUpperCase() + value.slice(1);

        return (
          <div key={to} className="flex items-center space-x-2">
            <ChevronRight className="w-4 h-4" />
            {isLast ? (
              <span className="text-foreground font-medium">{routeName}</span>
            ) : (
              <Link
                to={to}
                className="hover:text-foreground transition-colors"
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
