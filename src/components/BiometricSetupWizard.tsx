import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Shield, Zap, Scan, ScanFace } from "lucide-react";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { getBiometricInfo, getSetupInstructions, detectPlatform } from "@/lib/platformDetection";

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
  
  const biometricInfo = useMemo(() => getBiometricInfo(), []);
  const platform = useMemo(() => detectPlatform(), []);
  const setupInstructions = useMemo(() => getSetupInstructions(), []);
  
  // Get the appropriate icon based on platform
  const BiometricIcon = useMemo(() => {
    switch (biometricInfo.icon) {
      case 'face-id':
        return ScanFace;
      case 'touch-id':
      case 'fingerprint':
        return Fingerprint;
      case 'windows-hello':
        return Scan;
      default:
        return Fingerprint;
    }
  }, [biometricInfo.icon]);

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
                <BiometricIcon className="w-8 h-8 text-primary" />
              </div>
              <DialogTitle className="text-center text-xl">
                Enable {biometricInfo.name}
              </DialogTitle>
              <DialogDescription className="text-center space-y-4 pt-2">
                <p>
                  {biometricInfo.description} next time.
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
                <BiometricIcon className="w-4 h-4 mr-2" />
                Set Up {biometricInfo.name}
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
              <BiometricIcon className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="mb-2">Waiting for {biometricInfo.name}...</DialogTitle>
            <DialogDescription>
              {setupInstructions}
            </DialogDescription>
          </div>
        )}

        {step === "success" && (
          <>
            <DialogHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <BiometricIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <DialogTitle className="text-center text-xl">
                You're All Set!
              </DialogTitle>
              <DialogDescription className="text-center pt-2">
                Next time you visit, just tap "{biometricInfo.name}" for instant access.
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
