import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet } from "lucide-react";

export function UserExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportUsers = async () => {
    setIsExporting(true);
    try {
      // Fetch all users with roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .order("created_at", { ascending: false });

      if (rolesError) throw rolesError;

      if (!rolesData || rolesData.length === 0) {
        toast({
          title: "No Data",
          description: "No users found to export",
          variant: "destructive",
        });
        return;
      }

      // Fetch profiles
      const userIds = rolesData.map((r) => r.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department, phone")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Merge data
      const users = rolesData.map((role) => {
        const profile = profilesData?.find((p) => p.user_id === role.user_id);
        return {
          email: profile?.email || "N/A",
          full_name: profile?.full_name || "Unknown",
          role: role.role,
          department: profile?.department || "",
          phone: profile?.phone || "",
          registered_at: new Date(role.created_at).toLocaleDateString(),
        };
      });

      // Generate CSV
      const headers = ["email", "full_name", "role", "department", "phone", "registered_at"];
      const csvRows = [
        headers.join(","),
        ...users.map((u) =>
          headers.map((h) => `"${(u as any)[h] || ""}"`).join(",")
        ),
      ];

      const csv = csvRows.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Exported ${users.length} user(s)`,
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export users",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" onClick={exportUsers} disabled={isExporting}>
      {isExporting ? (
        <>
          <FileSpreadsheet className="w-4 h-4 mr-2 animate-pulse" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Export Users
        </>
      )}
    </Button>
  );
}
