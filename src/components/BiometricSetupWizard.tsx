import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Shield, Zap, X } from "lucide-react";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

interface BiometricSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  email: string;
  onComplete?: () => void;
}

export const BiometricSetupWizard = ({
  open,
  onOpenChange,
  userId,
  email,
  onComplete,
}: BiometricSetupWizardProps) => {
  const [step, setStep] = useState<"intro" | "setup" | "success">("intro");
  const { registerBiometric, isLoading, markSetupWizardShown } = useBiometricAuth();

  const handleSetup = async () => {
    setStep("setup");
    const success = await registerBiometric(userId, email);
    if (success) {
      setStep("success");
    } else {
      setStep("intro");
    }
  };

  const handleSkip = () => {
    markSetupWizardShown(userId);
    onOpenChange(false);
  };

  const handleComplete = () => {
    markSetupWizardShown(userId);
    onOpenChange(false);
    onComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "intro" && (
          <>
            <DialogHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Fingerprint className="w-8 h-8 text-primary" />
              </div>
              <DialogTitle className="text-center text-xl">
                Enable Quick Sign-In
              </DialogTitle>
              <DialogDescription className="text-center space-y-4 pt-2">
                <p>
                  Use your fingerprint or face to sign in instantly next time.
                </p>
                <div className="grid gap-3 text-left mt-4">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Faster Sign-In</p>
                      <p className="text-sm text-muted-foreground">
                        Skip typing your email and password
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Secure</p>
                      <p className="text-sm text-muted-foreground">
                        Your biometric data never leaves your device
                      </p>
                    </div>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button onClick={handleSetup} className="w-full" disabled={isLoading}>
                <Fingerprint className="w-4 h-4 mr-2" />
                Set Up Now
              </Button>
              <Button variant="ghost" onClick={handleSkip} className="w-full">
                Maybe Later
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "setup" && (
          <div className="py-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
              <Fingerprint className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="mb-2">Waiting for Biometric...</DialogTitle>
            <DialogDescription>
              Follow your device's prompt to register your fingerprint or face
            </DialogDescription>
          </div>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <Fingerprint className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <DialogTitle className="text-center text-xl">
                You're All Set!
              </DialogTitle>
              <DialogDescription className="text-center pt-2">
                Next time you visit, just tap "Sign in with Biometrics" for instant access.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleComplete} className="w-full">
                Got It
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
