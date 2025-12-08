import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkStudentImportProps {
  courseId: string;
  onSuccess: () => void;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

const BulkStudentImport = ({ courseId, onSuccess }: BulkStudentImportProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const parseCSV = (text: string): string[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const emails: string[] = [];

    for (const line of lines) {
      // Handle CSV with multiple columns - look for email column
      const cells = line.split(",").map(cell => cell.trim().replace(/"/g, ""));
      
      for (const cell of cells) {
        // Simple email validation
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell)) {
          emails.push(cell.toLowerCase());
          break; // Take first email found in each row
        }
      }
    }

    // Remove duplicates
    return [...new Set(emails)];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const text = await file.text();
      const emails = parseCSV(text);

      if (emails.length === 0) {
        toast({
          title: "No Emails Found",
          description: "No valid email addresses found in the CSV file",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      const importResult: ImportResult = {
        total: emails.length,
        success: 0,
        failed: 0,
        errors: []
      };

      // Find profiles by email
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("email", emails);

      const foundEmails = new Set(profiles?.map(p => p.email.toLowerCase()) || []);

      // Check which students are already enrolled
      const { data: existingEnrollments } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("course_id", courseId);

      const alreadyEnrolled = new Set(existingEnrollments?.map(e => e.student_id) || []);

      // Process each email
      for (const email of emails) {
        if (!foundEmails.has(email)) {
          importResult.failed++;
          importResult.errors.push(`${email}: User not registered`);
          continue;
        }

        const profile = profiles?.find(p => p.email.toLowerCase() === email);
        if (!profile) continue;

        // Check if user has student role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id)
          .single();

        if (roleData?.role !== "student") {
          importResult.failed++;
          importResult.errors.push(`${email}: Not a student account`);
          continue;
        }

        if (alreadyEnrolled.has(profile.user_id)) {
          importResult.failed++;
          importResult.errors.push(`${email}: Already enrolled`);
          continue;
        }

        // Create enrollment
        const { error } = await supabase
          .from("enrollments")
          .insert({
            course_id: courseId,
            student_id: profile.user_id,
            status: "active"
          });

        if (error) {
          importResult.failed++;
          importResult.errors.push(`${email}: ${error.message}`);
        } else {
          importResult.success++;
        }
      }

      setResult(importResult);

      if (importResult.success > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully enrolled ${importResult.success} student(s)`
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process CSV file",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      // Reset file input
      e.target.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Import Students</DialogTitle>
          <DialogDescription>
            Upload a CSV file with student email addresses to enroll them in this course.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileSpreadsheet className="w-4 h-4" />
              CSV Format Requirements
            </div>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>One email per row or email in any column</li>
              <li>Students must already be registered</li>
              <li>Students must have "student" role</li>
            </ul>
          </div>

          <div>
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {isProcessing ? "Processing..." : "Click to upload CSV"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or drag and drop
                </p>
              </div>
            </Label>
            <Input
              id="csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />
          </div>

          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-muted rounded">
                  <p className="text-2xl font-bold">{result.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="p-2 bg-primary/10 rounded">
                  <p className="text-2xl font-bold text-primary">{result.success}</p>
                  <p className="text-xs text-muted-foreground">Success</p>
                </div>
                <div className="p-2 bg-destructive/10 rounded">
                  <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-auto text-xs space-y-1">
                  {result.errors.map((error, i) => (
                    <div key={i} className="flex items-start gap-1 text-destructive">
                      <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setIsOpen(false);
            setResult(null);
          }}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkStudentImport;
