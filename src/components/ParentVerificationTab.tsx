import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Users, RefreshCw, Clock, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { PaginationControls } from "@/components/PaginationControls";

interface ParentStudentLink {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string;
  verified: boolean;
  created_at: string;
  parent_profile?: {
    full_name: string;
    email: string;
  };
  student_profile?: {
    full_name: string;
    email: string;
  };
}

const ITEMS_PER_PAGE = 10;

export function ParentVerificationTab() {
  const { toast } = useToast();
  const [links, setLinks] = useState<ParentStudentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "pending" | "verified">("pending");

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const { data: linksData, error } = await supabase
        .from("parent_students")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (linksData && linksData.length > 0) {
        // Get parent profiles
        const parentIds = linksData.map((l) => l.parent_id);
        const studentIds = linksData.map((l) => l.student_id);

        const { data: parentProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", parentIds);

        const { data: studentProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", studentIds);

        const enrichedLinks = linksData.map((link) => ({
          ...link,
          parent_profile: parentProfiles?.find((p) => p.user_id === link.parent_id),
          student_profile: studentProfiles?.find((p) => p.user_id === link.student_id),
        }));

        setLinks(enrichedLinks);
      } else {
        setLinks([]);
      }
    } catch (error) {
      console.error("Error fetching parent-student links:", error);
      toast({
        title: "Error",
        description: "Failed to load parent verifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (linkId: string, approve: boolean) => {
    setProcessing(linkId);
    try {
      if (approve) {
        const { error } = await supabase
          .from("parent_students")
          .update({ verified: true })
          .eq("id", linkId);

        if (error) throw error;

        toast({
          title: "Link Verified",
          description: "Parent-student link has been approved",
        });
      } else {
        const { error } = await supabase
          .from("parent_students")
          .delete()
          .eq("id", linkId);

        if (error) throw error;

        toast({
          title: "Link Rejected",
          description: "Parent-student link request has been removed",
        });
      }

      fetchLinks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process verification",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const filteredLinks = links.filter((link) => {
    if (filter === "pending") return !link.verified;
    if (filter === "verified") return link.verified;
    return true;
  });

  const totalPages = Math.ceil(filteredLinks.length / ITEMS_PER_PAGE);
  const paginatedLinks = filteredLinks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const pendingCount = links.filter((l) => !l.verified).length;
  const verifiedCount = links.filter((l) => l.verified).length;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Parent Verifications</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLinks} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div
          className={`p-4 rounded-lg cursor-pointer transition-colors ${
            filter === "all" ? "bg-primary/10 border-2 border-primary" : "bg-muted hover:bg-muted/80"
          }`}
          onClick={() => { setFilter("all"); setCurrentPage(1); }}
        >
          <p className="text-2xl font-bold">{links.length}</p>
          <p className="text-sm text-muted-foreground">Total Links</p>
        </div>
        <div
          className={`p-4 rounded-lg cursor-pointer transition-colors ${
            filter === "pending" ? "bg-yellow-500/10 border-2 border-yellow-500" : "bg-muted hover:bg-muted/80"
          }`}
          onClick={() => { setFilter("pending"); setCurrentPage(1); }}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
          <p className="text-sm text-muted-foreground">Pending</p>
        </div>
        <div
          className={`p-4 rounded-lg cursor-pointer transition-colors ${
            filter === "verified" ? "bg-green-500/10 border-2 border-green-500" : "bg-muted hover:bg-muted/80"
          }`}
          onClick={() => { setFilter("verified"); setCurrentPage(1); }}
        >
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-green-500" />
            <p className="text-2xl font-bold">{verifiedCount}</p>
          </div>
          <p className="text-sm text-muted-foreground">Verified</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="overflow-auto max-h-[500px]">
          {loading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : paginatedLinks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parent</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLinks.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{link.parent_profile?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{link.parent_profile?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{link.student_profile?.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{link.student_profile?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {link.relationship || "parent"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(link.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {link.verified ? (
                        <Badge className="bg-green-500">Verified</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!link.verified && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleVerify(link.id, true)}
                            disabled={processing === link.id}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleVerify(link.id, false)}
                            disabled={processing === link.id}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {filter === "pending"
                  ? "No pending verification requests"
                  : filter === "verified"
                  ? "No verified links yet"
                  : "No parent-student links found"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredLinks.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>
    </Card>
  );
}
