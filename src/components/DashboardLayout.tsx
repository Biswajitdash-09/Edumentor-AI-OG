import { ReactNode, useEffect, useState } from "react";
import { Brain, LogOut, User, BookOpen, MessageSquare, QrCode, Megaphone, Calendar, BarChart3, ArrowLeft, Home, Menu, Moon, Sun, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NotificationCenter } from "@/components/NotificationCenter";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DashboardLayoutProps {
  children: ReactNode;
  role?: "student" | "faculty" | "admin";
}


const DashboardLayout = ({ children, role }: DashboardLayoutProps) => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const toggleTheme = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    document.documentElement.classList.toggle("dark", newValue);
    localStorage.setItem("theme", newValue ? "dark" : "light");
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

  // Build navLinks dynamically based on user role
  const getNavLinks = () => {
    const links = [
      { to: "/courses", icon: BookOpen, label: "Courses" },
      { to: "/ai-mentor", icon: MessageSquare, label: "AI Mentor" },
      { to: "/attendance", icon: QrCode, label: "Attendance" },
      { to: "/announcements", icon: Megaphone, label: "Announcements" },
      { to: "/schedule", icon: Calendar, label: "Schedule" },
    ];
    // Show Analytics for faculty and admin
    if (userRole === "faculty" || userRole === "admin") {
      links.push({ to: "/analytics", icon: BarChart3, label: "Analytics" });
    }
    // Show student-specific links
    if (userRole === "student") {
      links.push({ to: "/my-analytics", icon: BarChart3, label: "My Analytics" });
      links.push({ to: "/grades", icon: Award, label: "Grades" });
    }
    return links;
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchUserRole();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setUserName(data.full_name);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchUserRole = async () => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .single();

      if (data) {
        setUserRole(data.role);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const getRoleLabel = () => {
    const displayRole = role || userRole;
    if (!displayRole) return "";
    switch (displayRole) {
      case "student":
        return "Student Portal";
      case "faculty":
        return "Faculty Portal";
      case "admin":
        return "Admin Portal";
    }
  };

  const getDashboardPath = () => {
    const r = role || userRole;
    if (r) return `/dashboard/${r}`;
    return "/";
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed Out",
      description: "You have been successfully signed out.",
    });
    navigate("/auth");
  };

  const canGoBack = () => {
    const dashboardPaths = ["/dashboard/student", "/dashboard/faculty", "/dashboard/admin", "/"];
    return !dashboardPaths.includes(location.pathname);
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate(getDashboardPath());
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2 md:gap-6">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 p-4 border-b">
                    <Brain className="w-8 h-8 text-primary" />
                    <span className="text-xl font-bold">EduMentor AI</span>
                  </div>
                  <nav className="flex-1 p-4">
                    <div className="space-y-2">
                      {getNavLinks().map((link) => (
                        <Link
                          key={link.to}
                          to={link.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            location.pathname === link.to
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <link.icon className="w-5 h-5" />
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </nav>
                  <div className="p-4 border-t">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{userName || user.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{getRoleLabel()}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          navigate("/profile");
                        }}
                      >
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-destructive hover:text-destructive"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOut();
                        }}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Log out
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Back & Home Buttons */}
            <div className="flex items-center gap-1">
              {canGoBack() && (
                <Button variant="ghost" size="icon" onClick={handleGoBack} title="Go Back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={handleGoHome} title="Dashboard Home">
                <Home className="w-5 h-5" />
              </Button>
            </div>

            <Link to={getDashboardPath()} className="flex items-center gap-2">
              <Brain className="w-8 h-8 text-primary" />
              <span className="text-lg md:text-xl font-bold hidden sm:inline">EduMentor AI</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4">
              {getNavLinks().map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 text-sm transition-colors ${
                    location.pathname === link.to
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              ))}
            </div>

            {(role || userRole) && (
              <span className="hidden lg:inline ml-2 text-sm text-muted-foreground">
                {getRoleLabel()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>

            <NotificationCenter />

            <DropdownMenu>
              <DropdownMenuTrigger asChild className="hidden md:flex">
                <Button variant="ghost" size="icon">
                  <User className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userName || user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 md:px-6 py-4 md:py-8">
        <Breadcrumbs />
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;