import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  BookOpen, 
  Brain, 
  Calendar, 
  BarChart3, 
  Users, 
  FileCheck,
  ChevronLeft,
  ChevronRight,
  GraduationCap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DemoVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FeatureSlide {
  icon: typeof BookOpen;
  title: string;
  description: string;
  features: string[];
  gradient: string;
}

const slides: FeatureSlide[] = [
  {
    icon: GraduationCap,
    title: "Welcome to EduMentor AI",
    description: "Your complete academic management platform powered by AI",
    features: [
      "Unified platform for students, faculty, and administrators",
      "AI-powered academic assistance and analytics",
      "Seamless course management and collaboration",
      "Mobile-first design with offline support"
    ],
    gradient: "from-primary/20 to-accent/20"
  },
  {
    icon: Brain,
    title: "AI Academic Mentor",
    description: "Get instant help with your studies",
    features: [
      "24/7 AI-powered doubt resolution",
      "Personalized study recommendations",
      "Context-aware assistance for each course",
      "Smart content summarization"
    ],
    gradient: "from-purple-500/20 to-blue-500/20"
  },
  {
    icon: BookOpen,
    title: "Smart Course Management",
    description: "Everything you need in one place",
    features: [
      "Centralized course materials and resources",
      "Assignment submission with plagiarism check",
      "Discussion forums for collaboration",
      "Video meeting integration"
    ],
    gradient: "from-blue-500/20 to-cyan-500/20"
  },
  {
    icon: Calendar,
    title: "Attendance & Scheduling",
    description: "Never miss a class again",
    features: [
      "QR-based attendance with geofencing",
      "Smart calendar integration",
      "Automated reminders and notifications",
      "Offline check-in support"
    ],
    gradient: "from-green-500/20 to-emerald-500/20"
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    description: "Track progress and identify opportunities",
    features: [
      "Real-time grade tracking",
      "Attendance analytics and trends",
      "At-risk student identification",
      "Export reports in PDF/Excel"
    ],
    gradient: "from-orange-500/20 to-yellow-500/20"
  },
  {
    icon: Users,
    title: "For Every Stakeholder",
    description: "Role-based features for everyone",
    features: [
      "Students: Learn, submit, track progress",
      "Faculty: Teach, grade, manage courses",
      "Parents: Monitor child's progress",
      "Admins: Full institutional oversight"
    ],
    gradient: "from-pink-500/20 to-rose-500/20"
  }
];

const DemoVideoDialog = ({ open, onOpenChange }: DemoVideoDialogProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const slide = slides[currentSlide];
  const Icon = slide.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
        <div className={cn("p-6 bg-gradient-to-br", slide.gradient)}>
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-background/80 rounded-lg">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              {slide.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <p className="text-lg text-muted-foreground">
              {slide.description}
            </p>

            <Card className="p-5 bg-background/80 backdrop-blur">
              <ul className="space-y-3">
                {slide.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <FileCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevSlide}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              {/* Dots */}
              <div className="flex gap-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      index === currentSlide
                        ? "bg-primary w-6"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    )}
                  />
                ))}
              </div>

              {currentSlide === slides.length - 1 ? (
                <Button
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="gap-1"
                >
                  Get Started
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextSlide}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DemoVideoDialog;
