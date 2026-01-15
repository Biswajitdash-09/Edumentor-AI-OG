import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

interface ConsentCheckboxesProps {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  onTermsChange: (checked: boolean) => void;
  onPrivacyChange: (checked: boolean) => void;
}

export const ConsentCheckboxes = ({
  termsAccepted,
  privacyAccepted,
  onTermsChange,
  onPrivacyChange,
}: ConsentCheckboxesProps) => {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start space-x-2">
        <Checkbox
          id="terms"
          checked={termsAccepted}
          onCheckedChange={(checked) => onTermsChange(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor="terms" className="text-sm font-normal leading-relaxed cursor-pointer">
          I agree to the{" "}
          <Link
            to="/terms"
            target="_blank"
            className="text-primary hover:underline font-medium"
          >
            Terms of Service
          </Link>
          <span className="text-destructive ml-1">*</span>
        </Label>
      </div>

      <div className="flex items-start space-x-2">
        <Checkbox
          id="privacy"
          checked={privacyAccepted}
          onCheckedChange={(checked) => onPrivacyChange(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor="privacy" className="text-sm font-normal leading-relaxed cursor-pointer">
          I have read and agree to the{" "}
          <Link
            to="/privacy"
            target="_blank"
            className="text-primary hover:underline font-medium"
          >
            Privacy Policy
          </Link>
          <span className="text-destructive ml-1">*</span>
        </Label>
      </div>
    </div>
  );
};
