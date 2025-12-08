import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, BookOpen, Users, BarChart3, Calendar, Award, MessageSquare, FileCheck, Heart, Mail, Linkedin, Github } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-image.jpg";
import DemoVideoDialog from "@/components/DemoVideoDialog";
import { SEOHead } from "@/components/SEOHead";

const Index = () => {
  const [showDemo, setShowDemo] = useState(false);
  const features = [
    {
      icon: BookOpen,
      title: "Smart Course Management",
      description: "Access all your courses, materials, and resources in one unified platform"
    },
    {
      icon: Brain,
      title: "AI Academic Mentor",
      description: "Get instant help with doubts, concepts, and personalized study recommendations"
    },
    {
      icon: FileCheck,
      title: "Automated Submissions",
      description: "Submit assignments with AI-powered plagiarism detection and instant feedback"
    },
    {
      icon: Calendar,
      title: "Smart Attendance",
      description: "QR-based attendance with geo-fencing and automatic analytics"
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description: "Track your academic progress with AI-driven insights and predictions"
    },
    {
      icon: Users,
      title: "Collaborative Learning",
      description: "Connect with peers, form study groups, and work on projects together"
    },
    {
      icon: MessageSquare,
      title: "Real-time Communication",
      description: "Stay updated with announcements, notifications, and important updates"
    },
    {
      icon: Award,
      title: "Research & Placement",
      description: "Access internship opportunities, project tracking, and career guidance"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead />
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-lg border-b border-border z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              <span className="text-lg sm:text-2xl font-bold text-foreground">EduMentor AI</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-sm sm:text-base">Login</Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="text-sm sm:text-base">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-4 sm:space-y-6 text-center lg:text-left">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                Transform Your <span className="text-primary">Academic Journey</span> with AI
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
                EduMentor AI unifies students, faculty, and administrators in one intelligent platform.
                Experience automated workflows, AI-powered assistance, and seamless academic management.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8">
                    Start Learning
                  </Button>
                </Link>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8"
                  onClick={() => setShowDemo(true)}
                >
                  Watch Demo
                </Button>
              </div>
            </div>
            <div className="relative hidden sm:block">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-3xl"></div>
              <img 
                src={heroImage} 
                alt="Educational platform interface" 
                className="relative rounded-3xl shadow-2xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-muted/50">
        <div className="container mx-auto">
          <div className="text-center mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">Everything You Need to Succeed</h2>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground">
              Comprehensive tools designed for modern education
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="p-4 sm:p-6 hover:shadow-lg transition-shadow">
                  <Icon className="w-8 h-8 sm:w-12 sm:h-12 text-primary mb-3 sm:mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="container mx-auto">
          <Card className="p-6 sm:p-8 lg:p-12 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
            <div className="text-center space-y-4 sm:space-y-6">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Ready to Transform Your Institution?</h2>
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
                Join thousands of students and educators already using EduMentor AI to enhance their academic experience.
              </p>
              <Link to="/auth">
                <Button size="lg" className="text-base sm:text-lg px-8 sm:px-12">
                  Get Started Today
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                <span className="text-lg sm:text-xl font-bold">EduMentor AI</span>
              </div>
              <div className="flex items-center gap-4 text-sm sm:text-base text-muted-foreground">
                <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
                <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground text-center">
                © 2025 EduMentor AI. All rights reserved.
              </p>
            </div>
            
            {/* Developer Contact */}
            <div className="border-t border-border pt-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="flex items-center gap-2 text-sm sm:text-base text-muted-foreground">
                  Made with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> by <span className="font-semibold text-foreground">Biswajit Dash</span>
                </p>
                <div className="flex items-center gap-4">
                  <a 
                    href="mailto:biswajitdash929@gmail.com" 
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span className="hidden sm:inline">biswajitdash929@gmail.com</span>
                    <span className="sm:hidden">Email</span>
                  </a>
                  <a 
                    href="https://www.linkedin.com/in/biswajitdash09" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span>LinkedIn</span>
                  </a>
                  <a 
                    href="https://github.com/Biswajitdash-09" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    <span>GitHub</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <DemoVideoDialog open={showDemo} onOpenChange={setShowDemo} />
    </div>
  );
};

export default Index;
