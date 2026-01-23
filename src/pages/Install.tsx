import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Download, Smartphone, Monitor, Check, Share, Plus, MoreVertical, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const features = [
    { icon: "📱", title: "Works Offline", description: "Check in to classes even without internet. Syncs automatically when online." },
    { icon: "⚡", title: "Lightning Fast", description: "Native-like performance with instant loading and smooth animations" },
    { icon: "🔔", title: "Push Notifications", description: "Get instant alerts for assignments, grades, and attendance sessions" },
    { icon: "📍", title: "Quick Check-In", description: "One-tap attendance with QR scan and location verification" },
    { icon: "📊", title: "Offline Analytics", description: "View your grades and progress even without connection" },
    { icon: "💾", title: "Less Storage", description: "Takes up minimal space compared to native apps" },
  ];

  if (isStandalone || isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEOHead title="App Installed" description="EduMentor AI is installed on your device" />
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">You're All Set!</CardTitle>
            <CardDescription>
              EduMentor AI is installed on your device. Enjoy the full app experience!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button size="lg" className="w-full">
                Open App
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <SEOHead 
        title="Install EduMentor AI" 
        description="Install EduMentor AI on your device for the best experience with offline access and instant notifications" 
      />
      
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Brain className="w-8 h-8 text-primary" />
          <span className="text-xl font-bold">EduMentor AI</span>
        </Link>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            <Download className="w-3 h-3 mr-1" />
            Free to Install
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Get the Full App Experience
          </h1>
          <p className="text-xl text-muted-foreground">
            Install EduMentor AI on your device for faster access, offline support, and instant notifications.
          </p>
        </div>

        {/* Install Button / Instructions */}
        <Card className="max-w-lg mx-auto mb-12">
          <CardContent className="p-6">
            {deferredPrompt ? (
              // Chrome/Edge - show install button
              <div className="text-center">
                <Button size="lg" onClick={handleInstallClick} className="w-full gap-2">
                  <Download className="w-5 h-5" />
                  Install EduMentor AI
                </Button>
                <p className="text-sm text-muted-foreground mt-3">
                  Click to add EduMentor AI to your home screen
                </p>
              </div>
            ) : isIOS ? (
              // iOS Instructions
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-center">Install on iPhone/iPad</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Tap the Share button</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Share className="w-4 h-4" /> at the bottom of Safari
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Scroll and tap "Add to Home Screen"</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Plus className="w-4 h-4" /> Look for this icon
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Tap "Add" to confirm</p>
                      <p className="text-sm text-muted-foreground">The app will appear on your home screen</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : isAndroid ? (
              // Android Instructions (if prompt not available)
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-center">Install on Android</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Tap the menu button</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MoreVertical className="w-4 h-4" /> Three dots in Chrome
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Tap "Install app" or "Add to Home screen"</p>
                      <p className="text-sm text-muted-foreground">The option may vary by browser</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Confirm the installation</p>
                      <p className="text-sm text-muted-foreground">The app will be added to your home screen</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Desktop
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-center">Install on Desktop</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Look for the install icon</p>
                      <p className="text-sm text-muted-foreground">
                        In Chrome/Edge, click the install icon in the address bar
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Click "Install"</p>
                      <p className="text-sm text-muted-foreground">The app will open in its own window</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Why Install?</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 bg-muted/30">
                <CardContent className="p-4 flex items-start gap-4">
                  <span className="text-2xl">{feature.icon}</span>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Supported Platforms */}
        <div className="max-w-lg mx-auto mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">Works on all major platforms</p>
          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Smartphone className="w-5 h-5" />
              <span>iOS & Android</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Monitor className="w-5 h-5" />
              <span>Windows & Mac</span>
            </div>
          </div>
        </div>

        {/* Skip Link */}
        <div className="text-center mt-12">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground underline">
            Continue to web version →
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Install;