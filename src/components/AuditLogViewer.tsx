import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Search, Filter, RefreshCw, UserCog, FileEdit, Trash2, Shield } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  user_name?: string;
}

const actionLabels: Record<string, { label: string; icon: typeof UserCog; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  role_change: { label: "Role Change", icon: UserCog, variant: "default" },
  grade_modification: { label: "Grade Modified", icon: FileEdit, variant: "secondary" },
  account_deletion: { label: "Account Deleted", icon: Trash2, variant: "destructive" },
  login: { label: "Login", icon: Shield, variant: "outline" },
};

export const AuditLogViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user names for logs
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((log) => log.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const logsWithNames: AuditLog[] = data.map((log) => ({
          ...log,
          old_value: log.old_value as Record<string, unknown> | null,
          new_value: log.new_value as Record<string, unknown> | null,
          metadata: log.metadata as Record<string, unknown> | null,
          user_name: profiles?.find((p) => p.user_id === log.user_id)?.full_name || "Unknown",
        }));

        setLogs(logsWithNames);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("audit_logs_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_logs",
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.user_name?.toLowerCase().includes(search) ||
      log.action.toLowerCase().includes(search) ||
      log.entity_type.toLowerCase().includes(search)
    );
  });

  const getActionInfo = (action: string) => {
    return actionLabels[action] || { label: action, icon: History, variant: "outline" as const };
  };

  const formatValue = (value: Record<string, unknown> | null) => {
    if (!value) return "-";
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${val}`)
      .join(", ");
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Audit Logs
        </h2>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="role_change">Role Changes</SelectItem>
            <SelectItem value="grade_modification">Grade Modifications</SelectItem>
            <SelectItem value="account_deletion">Account Deletions</SelectItem>
            <SelectItem value="login">Logins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[500px]">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredLogs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const actionInfo = getActionInfo(log.action);
                const Icon = actionInfo.icon;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">{log.user_name}</TableCell>
                    <TableCell>
                      <Badge variant={actionInfo.variant} className="flex items-center gap-1 w-fit">
                        <Icon className="w-3 h-3" />
                        {actionInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">{log.entity_type}</span>
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">
                      {log.old_value && log.new_value ? (
                        <span>
                          <span className="text-destructive line-through mr-2">
                            {formatValue(log.old_value)}
                          </span>
                          <span className="text-primary">{formatValue(log.new_value)}</span>
                        </span>
                      ) : (
                        formatValue(log.new_value || log.metadata)
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No audit logs found</p>
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};

export default AuditLogViewer;
