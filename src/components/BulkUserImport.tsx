import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Download, CheckCircle, XCircle, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkUserImportProps {
  onSuccess: () => void;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

interface UserEntry {
  email: string;
  full_name: string;
  role: string;
  department?: string;
}

export function BulkUserImport({ onSuccess }: BulkUserImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [defaultRole, setDefaultRole] = useState("student");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseCSV = (text: string): UserEntry[] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const entries: UserEntry[] = [];

    // Detect header
    const hasHeader = lines[0]?.toLowerCase().includes("email");
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const cells = lines[i].split(",").map((cell) => cell.trim().replace(/"/g, ""));
      
      const email = cells[0]?.toLowerCase();
      const full_name = cells[1] || email?.split("@")[0] || "User";
      const role = cells[2]?.toLowerCase() || defaultRole;
      const department = cells[3] || undefined;

      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const validRoles = ["student", "faculty", "admin", "parent"];
        entries.push({
          email,
          full_name,
          role: validRoles.includes(role) ? role : defaultRole,
          department,
        });
      }
    }

    return entries;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const text = await file.text();
      const users = parseCSV(text);

      if (users.length === 0) {
        toast({
          title: "No Users Found",
          description: "No valid user entries found in the CSV file",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const importResult: ImportResult = {
        total: users.length,
        success: 0,
        failed: 0,
        errors: [],
      };

      // Check existing profiles
      const { data: existingProfiles } = await supabase
        .from("profiles")
        .select("email, user_id")
        .in("email", users.map((u) => u.email));

      const existingEmails = new Map(
        existingProfiles?.map((p) => [p.email.toLowerCase(), p.user_id]) || []
      );

      for (const user of users) {
        try {
          if (existingEmails.has(user.email)) {
            // User already exists - update role if needed
            const userId = existingEmails.get(user.email)!;
            
            // Check if role already exists
            const { data: existingRole } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", userId)
              .single();

            if (!existingRole) {
              // Add role
              const { error: roleError } = await supabase
                .from("user_roles")
                .insert({ user_id: userId, role: user.role as any });

              if (roleError) {
                importResult.failed++;
                importResult.errors.push(`${user.email}: ${roleError.message}`);
              } else {
                importResult.success++;
              }
            } else {
              importResult.failed++;
              importResult.errors.push(`${user.email}: Already registered with role ${existingRole.role}`);
            }
          } else {
            // Note: We can't create auth users from the client
            // This is a limitation - users need to sign up themselves
            importResult.failed++;
            importResult.errors.push(`${user.email}: User not registered (invite needed)`);
          }
        } catch (error: any) {
          importResult.failed++;
          importResult.errors.push(`${user.email}: ${error.message}`);
        }
      }

      setResult(importResult);

      if (importResult.success > 0) {
        toast({
          title: "Import Complete",
          description: `Processed ${importResult.success} user(s) successfully`,
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process CSV file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const csv = `email,full_name,role,department
student@example.com,John Doe,student,Computer Science
faculty@example.com,Jane Smith,faculty,Mathematics`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setResult(null);
    setDefaultRole("student");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="w-4 h-4 mr-2" />
          Bulk Import Users
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Import Users</DialogTitle>
          <DialogDescription>
            Upload a CSV file to assign roles to existing users or prepare for future registrations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Default Role Selection */}
          <div>
            <Label>Default Role (for entries without role column)</Label>
            <Select value={defaultRole} onValueChange={setDefaultRole}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="faculty">Faculty</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CSV Format Info */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="w-4 h-4" />
                CSV Format
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Template
              </Button>
            </div>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Columns: email, full_name, role, department</li>
              <li>Users must be registered first</li>
              <li>Valid roles: student, faculty, admin, parent</li>
            </ul>
          </div>

          {/* Upload Area */}
          <div>
            <Label htmlFor="user-csv-upload" className="cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {isProcessing ? "Processing..." : "Click to upload CSV"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
              </div>
            </Label>
            <Input
              ref={fileInputRef}
              id="user-csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />
          </div>

          {/* Results */}
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
                  {result.errors.slice(0, 10).map((error, i) => (
                    <div key={i} className="flex items-start gap-1 text-destructive">
                      <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="text-muted-foreground">
                      ...and {result.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setIsOpen(false); resetState(); }}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
