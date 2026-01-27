import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Database, HardDrive, Users, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

interface HealthMetrics {
  tableRowCounts: Record<string, number>;
  totalRows: number;
  activeUsersToday: number;
  systemStatus: "healthy" | "warning" | "critical";
}

const SystemHealthCard = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Fetch row counts for key tables
      const tables = ["profiles", "courses", "enrollments", "assignments", "submissions", "attendance_records"] as const;
      const rowCounts: Record<string, number> = {};

      for (const table of tables) {
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
        rowCounts[table] = count || 0;
      }

      // Get active users (profiles updated recently)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const { count: activeUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("updated_at", oneDayAgo.toISOString());

      const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0);
      
      // Determine system status based on metrics
      let status: "healthy" | "warning" | "critical" = "healthy";
      if (totalRows > 50000) status = "warning";
      if (totalRows > 100000) status = "critical";

      setMetrics({
        tableRowCounts: rowCounts,
        totalRows,
        activeUsersToday: activeUsers || 0,
        systemStatus: status,
      });
    } catch (error) {
      console.error("Error fetching system metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-green-500";
      case "warning": return "text-yellow-500";
      case "critical": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "critical": return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health
          </CardTitle>
          <CardDescription>Database metrics and system status</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchMetrics} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading metrics...</div>
        ) : metrics ? (
          <>
            {/* Status Badge */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(metrics.systemStatus)}
                <span className="font-medium">System Status</span>
              </div>
              <Badge className={getStatusColor(metrics.systemStatus)}>
                {metrics.systemStatus.toUpperCase()}
              </Badge>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Database className="w-4 h-4" />
                  Total Records
                </div>
                <p className="text-2xl font-bold">{metrics.totalRows.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  Active Today
                </div>
                <p className="text-2xl font-bold">{metrics.activeUsersToday}</p>
              </div>
            </div>

            {/* Table Breakdown */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Table Usage</p>
              {Object.entries(metrics.tableRowCounts).map(([table, count]) => (
                <div key={table} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{table.replace("_", " ")}</span>
                    <span className="text-muted-foreground">{count.toLocaleString()}</span>
                  </div>
                  <Progress 
                    value={metrics.totalRows > 0 ? (count / metrics.totalRows) * 100 : 0} 
                    className="h-1"
                  />
                </div>
              ))}
            </div>

            {/* Storage Info */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <HardDrive className="w-4 h-4" />
                Storage Buckets
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">course-materials</Badge>
                <Badge variant="outline">assignment-submissions</Badge>
                <Badge variant="outline">avatars</Badge>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            Failed to load metrics
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SystemHealthCard;
