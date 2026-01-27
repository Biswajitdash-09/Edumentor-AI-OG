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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { History, Search, Filter, RefreshCw, UserCog, FileEdit, Trash2, Shield, Download, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { exportAuditLogsToPDF, exportAuditLogsToExcel } from "@/lib/auditExport";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      if (userFilter !== "all") {
        query = query.eq("user_id", userFilter);
      }

      if (dateRange.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }

      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
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

        // Build unique users list for filter
        const uniqueUsers = profiles?.map((p) => ({ id: p.user_id, name: p.full_name })) || [];
        setUsers(uniqueUsers);

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
      toast({ title: "Error", description: "Failed to fetch audit logs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, userFilter, dateRange]);

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

  const handleExportPDF = () => {
    if (filteredLogs.length === 0) {
      toast({ title: "No data", description: "No logs to export", variant: "destructive" });
      return;
    }
    exportAuditLogsToPDF(filteredLogs);
    toast({ title: "Export Complete", description: "PDF downloaded successfully" });
  };

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      toast({ title: "No data", description: "No logs to export", variant: "destructive" });
      return;
    }
    exportAuditLogsToExcel(filteredLogs);
    toast({ title: "Export Complete", description: "Excel file downloaded successfully" });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setActionFilter("all");
    setUserFilter("all");
    setDateRange({ from: undefined, to: undefined });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Audit Logs
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="role_change">Role Changes</SelectItem>
            <SelectItem value="grade_modification">Grade Modifications</SelectItem>
            <SelectItem value="account_deletion">Account Deletions</SelectItem>
            <SelectItem value="login">Logins</SelectItem>
          </SelectContent>
        </Select>

        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-40">
            <UserCog className="w-4 h-4 mr-2" />
            <SelectValue placeholder="User" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  `${format(dateRange.from, "LLL dd")} - ${format(dateRange.to, "LLL dd")}`
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                "Date range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {(searchTerm || actionFilter !== "all" || userFilter !== "all" || dateRange.from) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}
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

      {/* Results count */}
      <div className="mt-4 text-sm text-muted-foreground">
        Showing {filteredLogs.length} of {logs.length} logs
      </div>
    </Card>
  );
};

export default AuditLogViewer;
