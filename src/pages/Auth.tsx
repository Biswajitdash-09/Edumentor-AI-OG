import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Brain, Loader2, Phone, Mail, Fingerprint, ArrowLeft, GraduationCap, BookOpen, Shield, Users, ScanFace, Scan } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { BiometricSetupWizard } from "@/components/BiometricSetupWizard";
import { ConsentCheckboxes } from "@/components/ConsentCheckboxes";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SEOHead } from "@/components/SEOHead";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { getBiometricInfo, getBiometricActionText, detectPlatform } from "@/lib/platformDetection";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(100),
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

const phoneSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/, { message: "Phone must be in format +1234567890" }),
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const biometricMode = searchParams.get('mode') === 'biometric';
  
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string>("student");
  // Demo mode: Allow all roles for testing
  const [selectedRole, setSelectedRole] = useState<"student" | "faculty" | "admin" | "parent">("student");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [signupMethod, setSignupMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loading } = useAuth();
  const { 
    isSupported: biometricSupported, 
    isRegistered: biometricRegistered, 
    isLoading: biometricLoading,
    authenticateWithBiometric,
    shouldShowSetupWizard,
    getStoredCredential
  } = useBiometricAuth();
  
  // Platform-specific biometric info
  const biometricInfo = useMemo(() => getBiometricInfo(), []);
  const biometricActionText = useMemo(() => getBiometricActionText(), []);
  
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

  // Auto-trigger biometric auth if in biometric mode and registered
  useEffect(() => {
    if (biometricMode && biometricRegistered && !biometricLoading) {
      handleBiometricLogin();
    }
  }, [biometricMode, biometricRegistered, biometricLoading]);

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    const result = await authenticateWithBiometric();
    
    if (result.success && result.email) {
      // Get stored credential to sign in
      const stored = getStoredCredential();
      if (stored) {
        // We need to sign in with stored session or redirect to quick login
        // Since we can't store passwords, we'll use a magic link approach
        // For now, show success and let user know they're verified
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", stored.userId)
          .single();
        
        if (roleData) {
          // Check if there's an active session
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user.id === stored.userId) {
            toast({
              title: "Welcome Back!",
              description: "Biometric verification successful",
            });
            navigate(`/dashboard/${roleData.role}`);
            return;
          }
        }
        
        toast({
          title: "Biometric Verified",
          description: "Please enter your password to complete sign-in",
        });
      }
    }
    setIsLoading(false);
  };

  const handleLoginSuccess = async (userId: string, email: string, role: string) => {
    // Check if we should show biometric setup wizard
    // Skip biometric in iframe environments (preview mode)
    const isInIframe = window.self !== window.top;
    if (!isInIframe && shouldShowSetupWizard(userId)) {
      setPendingUserId(userId);
      setPendingEmail(email);
      setPendingRole(role);
      setShowBiometricSetup(true);
    } else {
      navigate(`/dashboard/${role}`);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email Sent",
        description: "Check your email for the password reset link",
      });
      setForgotPasswordOpen(false);
      setResetEmail("");
    }
    setResetLoading(false);
  };

  // Don't auto-redirect - let user choose to login
  // Only redirect after explicit login action

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const validated = loginSchema.parse({ email, password });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      if (data.user) {
        // Fetch user role to determine redirect
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .single();

        if (roleError || !roleData) {
          toast({
            title: "Login Error",
            description: "Your account role is not configured. Please contact support.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }
        
        toast({
          title: "Login Successful",
          description: "Welcome back to EduMentor AI!",
        });
        
        // Show biometric setup if first login on this device
        await handleLoginSuccess(data.user.id, validated.email, roleData.role);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login Failed",
          description: error.message || "Invalid credentials. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const validated = signupSchema.parse({ fullName, email, password });
      
      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: {
            full_name: validated.fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: data.user.id,
            email: validated.email,
            full_name: validated.fullName,
          });

        if (profileError) {
          console.error("Failed to create profile:", profileError);
        }

        // Save consent records
        const { error: consentError } = await supabase
          .from("user_consents")
          .insert({
            user_id: data.user.id,
            terms_accepted: true,
            privacy_accepted: true,
            terms_accepted_at: new Date().toISOString(),
            privacy_accepted_at: new Date().toISOString(),
          });

        if (consentError) {
          console.error("Failed to save consent:", consentError);
        }

        // Assign user role - all roles allowed for testing
        const { error: roleError } = await supabase.rpc("assign_user_role", {
          _user_id: data.user.id,
          _role: selectedRole,
        });

        if (roleError) {
          toast({
            title: "Signup Error",
            description: "Failed to assign role. Please try again or contact support.",
            variant: "destructive",
          });
          throw roleError;
        }

        // Send welcome email (don't await, run in background)
        supabase.functions.invoke("send-welcome-email", {
          body: {
            email: validated.email,
            fullName: validated.fullName,
            role: selectedRole
          }
        }).catch(err => console.error("Failed to send welcome email:", err));

        toast({
          title: "Account Created",
          description: `Welcome to EduMentor AI as ${selectedRole}!`,
        });
        
        // Show biometric setup for new users
        await handleLoginSuccess(data.user.id, validated.email, selectedRole);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Signup Failed",
          description: error.message || "Could not create account. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-6">
      <SEOHead 
        title="Sign In" 
        description="Sign in to EduMentor AI to access your courses, assignments, and academic tools."
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Brain className="w-10 h-10 text-primary" />
            <span className="text-3xl font-bold">EduMentor AI</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2">
            {biometricMode ? "Quick Sign In" : "Welcome Back"}
          </h1>
          <p className="text-muted-foreground">
            {biometricMode 
              ? biometricInfo.description
              : "Sign in to access your academic portal"}
          </p>
        </div>

        {/* Biometric Quick Sign-In Mode */}
        {biometricMode && biometricSupported && (
          <Card className="p-8 mb-4">
            <div className="text-center space-y-6">
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <BiometricIcon className="w-10 h-10 text-primary" />
              </div>
              
              {biometricRegistered ? (
                <>
                  <p className="text-muted-foreground">
                    Tap the button below to authenticate with {biometricInfo.name}
                  </p>
                  <Button 
                    size="lg" 
                    className="w-full gap-2"
                    onClick={handleBiometricLogin}
                    disabled={isLoading || biometricLoading}
                  >
                    {(isLoading || biometricLoading) ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <BiometricIcon className="w-5 h-5" />
                    )}
                    {(isLoading || biometricLoading) ? "Verifying..." : biometricActionText}
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">
                  {biometricInfo.name} sign-in is not set up yet. Please sign in with your credentials first, and you'll be prompted to enable it.
                </p>
              )}
              
              <Link to="/auth" className="block">
                <Button variant="ghost" className="w-full gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Use Email/Password Instead
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Show regular auth form if not in biometric mode or biometric not supported */}
        {(!biometricMode || !biometricSupported) && (
        <Card className="p-8">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={authMethod === "email" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => { setAuthMethod("email"); setOtpSent(false); }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant={authMethod === "phone" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => { setAuthMethod("phone"); setOtpSent(false); }}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Phone
                </Button>
              </div>

              {authMethod === "email" ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email"
                      name="email"
                      type="email" 
                      placeholder="your.email@institution.edu"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password"
                      name="password"
                      type="password" 
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="link" 
                    className="w-full" 
                    onClick={() => setForgotPasswordOpen(true)}
                  >
                    Forgot your password?
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  {!otpSent ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input 
                          id="phone"
                          type="tel" 
                          placeholder="+1234567890"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Include country code (e.g., +1 for US)
                        </p>
                      </div>
                      <Button 
                        type="button"
                        className="w-full" 
                        disabled={isLoading}
                        onClick={async () => {
                          try {
                            const validated = phoneSchema.parse({ phone });
                            setIsLoading(true);
                            const { error } = await supabase.auth.signInWithOtp({
                              phone: validated.phone,
                            });
                            if (error) throw error;
                            setOtpSent(true);
                            toast({
                              title: "OTP Sent",
                              description: "Check your phone for the verification code",
                            });
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description: error.message || "Failed to send OTP",
                              variant: "destructive",
                            });
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                      >
                        {isLoading ? "Sending..." : "Send OTP"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Enter Verification Code</Label>
                        <div className="flex justify-center">
                          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </div>
                      <Button 
                        type="button"
                        className="w-full" 
                        disabled={isLoading || otp.length !== 6}
                        onClick={async () => {
                          try {
                            setIsLoading(true);
                            const { data, error } = await supabase.auth.verifyOtp({
                              phone,
                              token: otp,
                              type: "sms",
                            });
                            if (error) throw error;
                            if (data.user) {
                              const { data: roleData } = await supabase
                                .from("user_roles")
                                .select("role")
                                .eq("user_id", data.user.id)
                                .single();
                              
                              toast({
                                title: "Login Successful",
                                description: "Welcome to EduMentor AI!",
                              });
                              navigate(`/dashboard/${roleData?.role || "student"}`);
                            }
                          } catch (error: any) {
                            toast({
                              title: "Verification Failed",
                              description: error.message,
                              variant: "destructive",
                            });
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                      >
                        {isLoading ? "Verifying..." : "Verify OTP"}
                      </Button>
                      <Button 
                        type="button" 
                        variant="link" 
                        className="w-full" 
                        onClick={() => { setOtpSent(false); setOtp(""); }}
                      >
                        Use different number
                      </Button>
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="signup">
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={signupMethod === "email" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => { setSignupMethod("email"); setSignupOtpSent(false); }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant={signupMethod === "phone" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => { setSignupMethod("phone"); setSignupOtpSent(false); }}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Phone
                </Button>
              </div>

              {signupMethod === "email" ? (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input 
                      id="signup-name"
                      name="fullName"
                      type="text" 
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input 
                      id="signup-email"
                      name="email"
                      type="email" 
                      placeholder="your.email@institution.edu"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input 
                      id="signup-password"
                      name="password"
                      type="password" 
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  
                  {/* Role selector for demo */}
                  <div className="space-y-2">
                    <Label>Account Type</Label>
                    <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as typeof selectedRole)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        <SelectItem value="student">
                          <span className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            Student
                          </span>
                        </SelectItem>
                        <SelectItem value="faculty">
                          <span className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-primary" />
                            Faculty / Teacher
                          </span>
                        </SelectItem>
                        <SelectItem value="admin">
                          <span className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            Administrator
                          </span>
                        </SelectItem>
                        <SelectItem value="parent">
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Parent
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Demo mode: All account types available for testing
                    </p>
                  </div>
                  
                  <ConsentCheckboxes
                    termsAccepted={termsAccepted}
                    privacyAccepted={privacyAccepted}
                    onTermsChange={setTermsAccepted}
                    onPrivacyChange={setPrivacyAccepted}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !termsAccepted || !privacyAccepted}
                  >
                    {isLoading ? "Creating account..." : `Create ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account`}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  {!signupOtpSent ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone-name">Full Name</Label>
                        <Input 
                          id="signup-phone-name"
                          type="text" 
                          placeholder="John Doe"
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone">Phone Number</Label>
                        <Input 
                          id="signup-phone"
                          type="tel" 
                          placeholder="+1234567890"
                          value={signupPhone}
                          onChange={(e) => setSignupPhone(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Include country code (e.g., +1 for US)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone-email">Email (for notifications)</Label>
                        <Input 
                          id="signup-phone-email"
                          type="email" 
                          placeholder="your.email@example.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Optional: Add email to receive notifications
                        </p>
                      </div>
                      
                      {/* Role selector for demo - phone signup */}
                      <div className="space-y-2">
                        <Label>Account Type</Label>
                        <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as typeof selectedRole)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select account type" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border border-border shadow-lg z-50">
                            <SelectItem value="student">
                              <span className="flex items-center gap-2">
                                <GraduationCap className="h-4 w-4 text-primary" />
                                Student
                              </span>
                            </SelectItem>
                            <SelectItem value="faculty">
                              <span className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-primary" />
                                Faculty / Teacher
                              </span>
                            </SelectItem>
                            <SelectItem value="admin">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-primary" />
                                Administrator
                              </span>
                            </SelectItem>
                            <SelectItem value="parent">
                              <span className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                Parent
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Demo mode: All account types available for testing
                        </p>
                      </div>
                      
                      <ConsentCheckboxes
                        termsAccepted={termsAccepted}
                        privacyAccepted={privacyAccepted}
                        onTermsChange={setTermsAccepted}
                        onPrivacyChange={setPrivacyAccepted}
                      />
                      <Button 
                        type="button"
                        className="w-full" 
                        disabled={isLoading || !signupName.trim() || !signupPhone.trim() || !termsAccepted || !privacyAccepted}
                        onClick={async () => {
                          try {
                            const validated = phoneSchema.parse({ phone: signupPhone });
                            if (signupName.trim().length < 2) {
                              throw new Error("Name must be at least 2 characters");
                            }
                            setIsLoading(true);
                            const { error } = await supabase.auth.signInWithOtp({
                              phone: validated.phone,
                              options: {
                                data: {
                                  full_name: signupName.trim(),
                                }
                              }
                            });
                            if (error) throw error;
                            setSignupOtpSent(true);
                            toast({
                              title: "OTP Sent",
                              description: "Check your phone for the verification code",
                            });
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description: error.message || "Failed to send OTP",
                              variant: "destructive",
                            });
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                      >
                        {isLoading ? "Sending..." : "Send OTP"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Enter Verification Code</Label>
                        <div className="flex justify-center">
                          <InputOTP maxLength={6} value={signupOtp} onChange={setSignupOtp}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </div>
                      <Button 
                        type="button"
                        className="w-full" 
                        disabled={isLoading || signupOtp.length !== 6}
                        onClick={async () => {
                          try {
                            setIsLoading(true);
                            const { data, error } = await supabase.auth.verifyOtp({
                              phone: signupPhone,
                              token: signupOtp,
                              type: "sms",
                            });
                            if (error) throw error;
                            
                            if (data.user) {
                              // Check if user already has a role (existing user)
                              const { data: existingRole } = await supabase
                                .from("user_roles")
                                .select("role")
                                .eq("user_id", data.user.id)
                                .single();

                              if (existingRole) {
                                // Existing user - redirect to their dashboard
                                toast({
                                  title: "Welcome Back",
                                  description: "Login successful!",
                                });
                                navigate(`/dashboard/${existingRole.role}`);
                              } else {
                                // New user - create profile and assign role
                                const { error: profileError } = await supabase
                                  .from("profiles")
                                  .insert({
                                    user_id: data.user.id,
                                    email: signupEmail.trim() || signupPhone,
                                    full_name: signupName.trim(),
                                    phone: signupPhone,
                                  });

                                if (profileError) {
                                  console.error("Failed to create profile:", profileError);
                                }

                                // Assign user role
                                const { error: roleError } = await supabase.rpc("assign_user_role", {
                                  _user_id: data.user.id,
                                  _role: selectedRole,
                                });

                                if (roleError) {
                                  toast({
                                    title: "Signup Error",
                                    description: "Failed to assign role. Please try again.",
                                    variant: "destructive",
                                  });
                                  throw roleError;
                                }

                                // Send welcome email (don't await) - only if email provided
                                if (signupEmail.trim()) {
                                  supabase.functions.invoke("send-welcome-email", {
                                    body: {
                                      email: signupEmail.trim(),
                                      fullName: signupName.trim(),
                                      role: selectedRole
                                    }
                                  }).catch(err => console.error("Failed to send welcome email:", err));
                                }

                                toast({
                                  title: "Account Created",
                                  description: `Welcome to EduMentor AI as ${selectedRole}!`,
                                });
                                
                                navigate(`/dashboard/${selectedRole}`);
                              }
                            }
                          } catch (error: any) {
                            toast({
                              title: "Verification Failed",
                              description: error.message,
                              variant: "destructive",
                            });
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                      >
                        {isLoading ? "Creating account..." : `Create ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Account`}
                      </Button>
                      <Button 
                        type="button" 
                        variant="link" 
                        className="w-full" 
                        onClick={() => { setSignupOtpSent(false); setSignupOtp(""); }}
                      >
                        Use different number
                      </Button>
                    </>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        </p>
      </div>

      {/* Biometric Setup Wizard */}
      {pendingUserId && pendingEmail && (
        <BiometricSetupWizard
          open={showBiometricSetup}
          onOpenChange={(open) => {
            setShowBiometricSetup(open);
            // If closing without completing, still navigate
            if (!open) {
              navigate(`/dashboard/${pendingRole}`);
            }
          }}
          userId={pendingUserId}
          email={pendingEmail}
          onComplete={() => {
            navigate(`/dashboard/${pendingRole}`);
          }}
        />
      )}

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your.email@institution.edu"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotPasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleForgotPassword} disabled={resetLoading}>
              {resetLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
