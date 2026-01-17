import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BiometricCredential {
  credentialId: string;
  userId: string;
  email: string;
  createdAt: string;
}

const BIOMETRIC_STORAGE_KEY = 'eduMentor_biometric_credentials';
const BIOMETRIC_SETUP_SHOWN_KEY = 'eduMentor_biometric_setup_shown';

// Check if running in an iframe
const isInIframe = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true; // If we can't access window.top, we're in a cross-origin iframe
  }
};

export const useBiometricAuth = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check if WebAuthn is supported (disabled in iframes due to security restrictions)
  useEffect(() => {
    const checkSupport = async () => {
      // WebAuthn is blocked in cross-origin iframes for security
      if (isInIframe()) {
        setIsSupported(false);
        return;
      }
      
      if (window.PublicKeyCredential) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setIsSupported(available);
        } catch {
          setIsSupported(false);
        }
      }
    };
    checkSupport();
  }, []);

  // Check if user has registered biometrics
  useEffect(() => {
    const stored = localStorage.getItem(BIOMETRIC_STORAGE_KEY);
    if (stored) {
      setIsRegistered(true);
    }
  }, []);

  const getStoredCredential = useCallback((): BiometricCredential | null => {
    const stored = localStorage.getItem(BIOMETRIC_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }, []);

  const registerBiometric = useCallback(async (userId: string, email: string): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Biometric authentication is not available on this device",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);
    try {
      // Generate a challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "EduMentor AI",
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(userId),
            name: email,
            displayName: email.split('@')[0],
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (credential) {
        // Store credential info locally
        const biometricData: BiometricCredential = {
          credentialId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          userId,
          email,
          createdAt: new Date().toISOString(),
        };
        
        localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(biometricData));
        setIsRegistered(true);
        
        toast({
          title: "Biometric Enabled",
          description: "You can now sign in quickly using your fingerprint or face",
        });
        
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Biometric registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Could not set up biometric authentication",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, toast]);

  const authenticateWithBiometric = useCallback(async (): Promise<{ success: boolean; userId?: string; email?: string }> => {
    const stored = getStoredCredential();
    if (!stored) {
      toast({
        title: "Not Set Up",
        description: "Biometric sign-in is not configured. Please sign in with your credentials first.",
        variant: "destructive",
      });
      return { success: false };
    }

    setIsLoading(true);
    try {
      // Generate a challenge
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // Request authentication
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{
            id: Uint8Array.from(atob(stored.credentialId), c => c.charCodeAt(0)),
            type: "public-key",
            transports: ["internal"],
          }],
          userVerification: "required",
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (assertion) {
        return { 
          success: true, 
          userId: stored.userId,
          email: stored.email 
        };
      }
      return { success: false };
    } catch (error: any) {
      console.error('Biometric auth error:', error);
      if (error.name !== 'NotAllowedError') {
        toast({
          title: "Authentication Failed",
          description: "Biometric verification failed. Please try again or use your credentials.",
          variant: "destructive",
        });
      }
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [getStoredCredential, toast]);

  const removeBiometric = useCallback(() => {
    localStorage.removeItem(BIOMETRIC_STORAGE_KEY);
    setIsRegistered(false);
    toast({
      title: "Biometric Removed",
      description: "Biometric sign-in has been disabled for this device",
    });
  }, [toast]);

  const shouldShowSetupWizard = useCallback((userId: string): boolean => {
    if (!isSupported || isRegistered) return false;
    const shownKey = `${BIOMETRIC_SETUP_SHOWN_KEY}_${userId}`;
    return !localStorage.getItem(shownKey);
  }, [isSupported, isRegistered]);

  const markSetupWizardShown = useCallback((userId: string) => {
    const shownKey = `${BIOMETRIC_SETUP_SHOWN_KEY}_${userId}`;
    localStorage.setItem(shownKey, 'true');
  }, []);

  return {
    isSupported,
    isRegistered,
    isLoading,
    registerBiometric,
    authenticateWithBiometric,
    removeBiometric,
    getStoredCredential,
    shouldShowSetupWizard,
    markSetupWizardShown,
  };
};
