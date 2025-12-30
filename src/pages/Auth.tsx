import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Brain, Loader2, Phone, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SEOHead } from "@/components/SEOHead";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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
  const [isLoading, setIsLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  // Production: Only student role allowed for self-registration
  const selectedRole = "student" as const;
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
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loading } = useAuth();

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
        
        navigate(`/dashboard/${roleData.role}`);
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
        
        navigate(`/dashboard/${selectedRole}`);
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
          <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to access your academic portal</p>
        </div>

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
                  <p className="text-sm text-muted-foreground">
                    You will be registered as a <strong>Student</strong>. Faculty and Admin accounts must be created by an administrator.
                  </p>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
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
                      <p className="text-sm text-muted-foreground">
                        You will be registered as a <strong>Student</strong>. Faculty and Admin accounts must be created by an administrator.
                      </p>
                      <Button 
                        type="button"
                        className="w-full" 
                        disabled={isLoading || !signupName.trim() || !signupPhone.trim()}
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

        <p className="text-center text-sm text-muted-foreground mt-6">
          By continuing, you agree to our{" "}
          <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
        </p>
      </div>

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
