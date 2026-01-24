import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Contains uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Contains lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Contains number", test: (p) => /\d/.test(p) },
  { label: "Contains special character", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    
    const passedCount = requirements.filter((req) => req.test(password)).length;
    
    if (passedCount <= 1) return { score: 1, label: "Weak", color: "bg-destructive" };
    if (passedCount <= 2) return { score: 2, label: "Fair", color: "bg-orange-500" };
    if (passedCount <= 3) return { score: 3, label: "Good", color: "bg-yellow-500" };
    if (passedCount <= 4) return { score: 4, label: "Strong", color: "bg-green-500" };
    return { score: 5, label: "Very Strong", color: "bg-green-600" };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span className={cn(
            "font-medium",
            strength.score <= 1 && "text-destructive",
            strength.score === 2 && "text-orange-500",
            strength.score === 3 && "text-yellow-600",
            strength.score >= 4 && "text-green-600"
          )}>
            {strength.label}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <div
              key={level}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                level <= strength.score ? strength.color : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Requirements Checklist */}
      <div className="space-y-1">
        {requirements.map((req, index) => {
          const passed = req.test(password);
          return (
            <div key={index} className="flex items-center gap-2 text-xs">
              {passed ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={cn(
                passed ? "text-green-600" : "text-muted-foreground"
              )}>
                {req.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PasswordStrengthIndicator;
