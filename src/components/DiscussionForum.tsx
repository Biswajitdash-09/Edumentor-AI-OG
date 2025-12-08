import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus, Pin, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Discussion {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
  };
  reply_count?: number;
}

interface Reply {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
  };
}

interface DiscussionForumProps {
  courseId: string;
  userRole: string;
  isFacultyOwner: boolean;
}

const DiscussionForum = ({ courseId, userRole, isFacultyOwner }: DiscussionForumProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDiscussion, setNewDiscussion] = useState({ title: "", content: "" });
  const [newReply, setNewReply] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiscussions();
  }, [courseId]);

  const fetchDiscussions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("discussions")
      .select(`id, title, content, is_pinned, created_at, user_id`)
      .eq("course_id", courseId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Get user profiles separately
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => {
        profileMap[p.user_id] = p.full_name;
      });

      // Get reply counts
      const discussionIds = data.map(d => d.id);
      const { data: replyCounts } = await supabase
        .from("discussion_replies")
        .select("discussion_id")
        .in("discussion_id", discussionIds);

      const countMap: Record<string, number> = {};
      replyCounts?.forEach(r => {
        countMap[r.discussion_id] = (countMap[r.discussion_id] || 0) + 1;
      });

      setDiscussions(data.map(d => ({
        ...d,
        profiles: { full_name: profileMap[d.user_id] || "Unknown" },
        reply_count: countMap[d.id] || 0
      })));
    }
    setLoading(false);
  };

  const fetchReplies = async (discussionId: string) => {
    const { data } = await supabase
      .from("discussion_replies")
      .select(`id, content, created_at, user_id`)
      .eq("discussion_id", discussionId)
      .order("created_at", { ascending: true });

    if (data) {
      // Get user profiles
      const userIds = [...new Set(data.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap: Record<string, string> = {};
      profiles?.forEach(p => {
        profileMap[p.user_id] = p.full_name;
      });

      setReplies(data.map(r => ({
        ...r,
        profiles: { full_name: profileMap[r.user_id] || "Unknown" }
      })));
    }
  };

  const handleCreateDiscussion = async () => {
    if (!newDiscussion.title.trim() || !newDiscussion.content.trim()) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("discussions").insert({
      course_id: courseId,
      user_id: user?.id,
      title: newDiscussion.title,
      content: newDiscussion.content
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Discussion created" });
      setIsCreateOpen(false);
      setNewDiscussion({ title: "", content: "" });
      fetchDiscussions();
    }
  };

  const handleAddReply = async () => {
    if (!newReply.trim() || !selectedDiscussion) return;

    const { error } = await supabase.from("discussion_replies").insert({
      discussion_id: selectedDiscussion.id,
      user_id: user?.id,
      content: newReply
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewReply("");
      fetchReplies(selectedDiscussion.id);
      fetchDiscussions();
    }
  };

  const handleTogglePin = async (discussion: Discussion) => {
    const { error } = await supabase
      .from("discussions")
      .update({ is_pinned: !discussion.is_pinned })
      .eq("id", discussion.id);

    if (!error) fetchDiscussions();
  };

  const handleDeleteDiscussion = async (id: string) => {
    const { error } = await supabase.from("discussions").delete().eq("id", id);
    if (!error) {
      setSelectedDiscussion(null);
      fetchDiscussions();
    }
  };

  const getInitials = (name: string) => {
    return name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?";
  };

  if (selectedDiscussion) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedDiscussion(null)}>
          ← Back to Discussions
        </Button>
        
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {selectedDiscussion.is_pinned && <Badge variant="secondary"><Pin className="w-3 h-3 mr-1" />Pinned</Badge>}
                  <CardTitle>{selectedDiscussion.title}</CardTitle>
                </div>
                <CardDescription>
                  {selectedDiscussion.profiles?.full_name} • {format(new Date(selectedDiscussion.created_at), "MMM d, yyyy h:mm a")}
                </CardDescription>
              </div>
              {(selectedDiscussion.user_id === user?.id || isFacultyOwner) && (
                <Button variant="ghost" size="icon" onClick={() => handleDeleteDiscussion(selectedDiscussion.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{selectedDiscussion.content}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Replies ({replies.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {replies.map(reply => (
              <div key={reply.id} className="flex gap-3 p-3 bg-muted rounded-lg">
                <Avatar className="w-8 h-8">
                  <AvatarFallback>{getInitials(reply.profiles?.full_name || "")}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{reply.profiles?.full_name}</span>
                    <span className="text-muted-foreground">{format(new Date(reply.created_at), "MMM d, h:mm a")}</span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{reply.content}</p>
                </div>
              </div>
            ))}
            
            {replies.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No replies yet</p>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Textarea
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1"
                rows={2}
              />
              <Button onClick={handleAddReply} disabled={!newReply.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Course Discussions</h3>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Discussion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start a Discussion</DialogTitle>
              <DialogDescription>Ask a question or start a conversation with your class</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={newDiscussion.title}
                  onChange={(e) => setNewDiscussion({ ...newDiscussion, title: e.target.value })}
                  placeholder="Discussion topic..."
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  value={newDiscussion.content}
                  onChange={(e) => setNewDiscussion({ ...newDiscussion, content: e.target.value })}
                  placeholder="Write your message..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateDiscussion}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading discussions...</div>
      ) : discussions.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No discussions yet. Start the conversation!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {discussions.map(discussion => (
            <Card
              key={discussion.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                setSelectedDiscussion(discussion);
                fetchReplies(discussion.id);
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {discussion.is_pinned && <Pin className="w-4 h-4 text-primary" />}
                    <CardTitle className="text-base">{discussion.title}</CardTitle>
                  </div>
                  {isFacultyOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(discussion);
                      }}
                    >
                      <Pin className={`w-4 h-4 ${discussion.is_pinned ? "text-primary" : ""}`} />
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {discussion.profiles?.full_name} • {format(new Date(discussion.created_at), "MMM d, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{discussion.content}</p>
                <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                  <MessageSquare className="w-4 h-4" />
                  <span>{discussion.reply_count} replies</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiscussionForum;
