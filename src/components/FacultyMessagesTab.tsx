import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Mail, MailOpen, ArrowLeft, Search } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  parent_id: string;
  student_id: string;
  subject: string;
  content: string;
  sender_type: string;
  is_read: boolean;
  created_at: string;
  parent_name?: string;
  student_name?: string;
}

interface Conversation {
  parent_id: string;
  student_id: string;
  parent_name: string;
  student_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  messages: Message[];
}

const FacultyMessagesTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (user) fetchMessages();
  }, [user]);

  // Real-time subscription for new messages
  useRealtimeSubscription(
    [
      {
        table: "parent_messages",
        event: "INSERT",
        filter: `faculty_id=eq.${user?.id}`,
        onData: () => fetchMessages(),
      },
    ],
    !!user
  );

  const fetchMessages = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: messages, error } = await supabase
        .from("parent_messages")
        .select("*")
        .eq("faculty_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get unique parent-student pairs
      const conversationMap = new Map<string, Conversation>();

      for (const msg of messages || []) {
        const key = `${msg.parent_id}-${msg.student_id}`;

        if (!conversationMap.has(key)) {
          // Fetch parent and student names
          const { data: parentProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", msg.parent_id)
            .single();

          const { data: studentProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", msg.student_id)
            .single();

          conversationMap.set(key, {
            parent_id: msg.parent_id,
            student_id: msg.student_id,
            parent_name: parentProfile?.full_name || "Parent",
            student_name: studentProfile?.full_name || "Student",
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread_count: 0,
            messages: [],
          });
        }

        const conv = conversationMap.get(key)!;
        conv.messages.push({
          ...msg,
          parent_name: conv.parent_name,
          student_name: conv.student_name,
        });

        if (!msg.is_read && msg.sender_type === "parent") {
          conv.unread_count++;
        }
      }

      setConversations(Array.from(conversationMap.values()));
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({ title: "Error", description: "Failed to load messages", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);

    // Mark unread messages as read
    const unreadIds = conv.messages
      .filter((m) => !m.is_read && m.sender_type === "parent")
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await supabase.from("parent_messages").update({ is_read: true }).in("id", unreadIds);
      fetchMessages();
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !selectedConversation || !user) return;

    try {
      const { error } = await supabase.from("parent_messages").insert({
        faculty_id: user.id,
        parent_id: selectedConversation.parent_id,
        student_id: selectedConversation.student_id,
        subject: "Re: " + (selectedConversation.messages[0]?.subject || "Message"),
        content: replyContent,
        sender_type: "faculty",
        is_read: false,
      });

      if (error) throw error;

      toast({ title: "Sent", description: "Reply sent successfully" });
      setReplyContent("");
      fetchMessages();
    } catch (error) {
      console.error("Error sending reply:", error);
      toast({ title: "Error", description: "Failed to send reply", variant: "destructive" });
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.parent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.student_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedConversation) {
    return (
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedConversation(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <CardTitle className="text-lg">{selectedConversation.parent_name}</CardTitle>
              <CardDescription>Regarding: {selectedConversation.student_name}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] p-4">
            <div className="space-y-4">
              {selectedConversation.messages
                .slice()
                .reverse()
                .map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_type === "faculty" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-lg ${
                        msg.sender_type === "faculty"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {format(new Date(msg.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t flex gap-2">
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write your reply..."
              rows={2}
              className="flex-1"
            />
            <Button onClick={handleReply} disabled={!replyContent.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Parent Messages
        </CardTitle>
        <CardDescription>View and respond to messages from parents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No messages from parents</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conv) => (
              <div
                key={`${conv.parent_id}-${conv.student_id}`}
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleSelectConversation(conv)}
              >
                <Avatar>
                  <AvatarFallback>{getInitials(conv.parent_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{conv.parent_name}</p>
                    {conv.unread_count > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    Re: {conv.student_name}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{conv.last_message}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {conv.unread_count > 0 ? (
                    <Mail className="w-4 h-4 text-primary" />
                  ) : (
                    <MailOpen className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(conv.last_message_time), "MMM d")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FacultyMessagesTab;
