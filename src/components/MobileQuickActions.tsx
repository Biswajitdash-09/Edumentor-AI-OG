import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  QrCode,
  BookOpen,
  Brain,
  Calendar,
  Bell,
  BarChart3,
  Plus,
  Home,
} from "lucide-react";

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  color: string;
}

interface MobileQuickActionsProps {
  role: string;
}

export function MobileQuickActions({ role }: MobileQuickActionsProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const studentActions: QuickAction[] = [
    { icon: QrCode, label: "Check In", path: "/attendance", color: "bg-green-500" },
    { icon: BookOpen, label: "Courses", path: "/courses", color: "bg-blue-500" },
    { icon: Brain, label: "AI Mentor", path: "/ai-mentor", color: "bg-purple-500" },
    { icon: Calendar, label: "Schedule", path: "/schedule", color: "bg-orange-500" },
    { icon: BarChart3, label: "Analytics", path: "/my-analytics", color: "bg-teal-500" },
    { icon: Bell, label: "Alerts", path: "/announcements", color: "bg-pink-500" },
  ];

  const facultyActions: QuickAction[] = [
    { icon: Plus, label: "New Session", path: "/attendance", color: "bg-green-500" },
    { icon: BookOpen, label: "Courses", path: "/courses", color: "bg-blue-500" },
    { icon: BarChart3, label: "Analytics", path: "/analytics", color: "bg-purple-500" },
    { icon: Calendar, label: "Schedule", path: "/schedule", color: "bg-orange-500" },
    { icon: Bell, label: "Announce", path: "/announcements", color: "bg-pink-500" },
  ];

  const actions = role === "faculty" ? facultyActions : studentActions;

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 md:hidden z-40">
      {/* Bottom Navigation Bar */}
      <div className="bg-background/95 backdrop-blur-lg border-t border-border shadow-lg">
        <div className="flex items-center justify-around py-2 px-4 safe-area-pb">
          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            onClick={() => navigate(role === "student" ? "/dashboard/student" : role === "faculty" ? "/dashboard/faculty" : "/dashboard/admin")}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px]">Home</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            onClick={() => navigate("/courses")}
          >
            <BookOpen className="h-5 w-5" />
            <span className="text-[10px]">Courses</span>
          </Button>

          {/* Center Action Button */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full shadow-lg -mt-6 bg-primary hover:bg-primary/90"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl">
              <SheetHeader className="pb-4">
                <SheetTitle>Quick Actions</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-4 pb-8">
                {actions.map((action) => (
                  <button
                    key={action.path}
                    onClick={() => handleNavigate(action.path)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className={`${action.color} p-3 rounded-full`}>
                      <action.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            onClick={() => navigate("/attendance")}
          >
            <QrCode className="h-5 w-5" />
            <span className="text-[10px]">Attend</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="flex flex-col items-center gap-1 h-auto py-2 px-3"
            onClick={() => navigate("/ai-mentor")}
          >
            <Brain className="h-5 w-5" />
            <span className="text-[10px]">AI</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
