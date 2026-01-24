import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";

type AuditAction = 
  | "role_change" 
  | "grade_modification" 
  | "account_deletion" 
  | "login" 
  | "logout"
  | "data_export"
  | "consent_update";

interface AuditLogParams {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export const useAuditLog = () => {
  const { toast } = useToast();

  const logAction = async ({
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    metadata,
  }: AuditLogParams) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn("Cannot log action: No authenticated user");
        return;
      }

      const logEntry: {
        user_id: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        old_value: Json | null;
        new_value: Json | null;
        metadata: Json;
      } = {
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        old_value: (oldValue as Json) || null,
        new_value: (newValue as Json) || null,
        metadata: (metadata as Json) || {},
      };

      const { error } = await supabase.from("audit_logs").insert([logEntry]);

      if (error) {
        console.error("Failed to create audit log:", error);
        // Show toast for audit log failure
        toast({
          title: "Audit Log Warning",
          description: "Failed to record this action in the audit log. The action itself was successful.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error in audit logging:", err);
      toast({
        title: "Audit Log Error",
        description: "An error occurred while recording this action.",
        variant: "destructive",
      });
    }
  };

  return { logAction };
};

export default useAuditLog;

