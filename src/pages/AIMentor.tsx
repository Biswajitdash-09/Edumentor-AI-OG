import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Send, Loader2, History, Plus, Trash2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, differenceInMinutes } from "date-fns";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  date: string;
  preview: string;
  messages: Message[];
  startTime: Date;
}

const SESSION_GAP_MINUTES = 30; // New session if gap > 30 minutes

const AIMentor = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      loadChatHistory();
    }
  }, [user]);

  const loadChatHistory = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      // Group messages into sessions based on time gaps
      const sessions: ChatSession[] = [];
      let currentSession: ChatSession | null = null;
      let lastMessageTime: Date | null = null;

      data.forEach((msg, index) => {
        const msgTime = new Date(msg.created_at);
        
        // Start a new session if:
        // 1. This is the first message, or
        // 2. The gap from last message is > SESSION_GAP_MINUTES, or
        // 3. This is a user message after an assistant message with significant gap
        const shouldStartNewSession = 
          !currentSession ||
          !lastMessageTime ||
          differenceInMinutes(msgTime, lastMessageTime) > SESSION_GAP_MINUTES;

        if (shouldStartNewSession) {
          currentSession = {
            id: `session-${sessions.length + 1}-${msg.id}`,
            date: format(msgTime, "MMM d, yyyy"),
            preview: "",
            messages: [],
            startTime: msgTime
          };
          sessions.push(currentSession);
        }

        currentSession!.messages.push({ 
          role: msg.role as "user" | "assistant", 
          content: msg.content 
        });

        // Set preview from first user message in session
        if (msg.role === "user" && !currentSession!.preview) {
          currentSession!.preview = msg.content.slice(0, 50) + (msg.content.length > 50 ? "..." : "");
        }

        lastMessageTime = msgTime;
      });

      // Reverse to show newest first
      const sessionsReversed = sessions.reverse();
      setChatSessions(sessionsReversed);

      // Load the most recent session only if we don't have a current session
      if (sessionsReversed.length > 0 && !currentSessionId) {
        const latestSession = sessionsReversed[0];
        setCurrentSessionId(latestSession.id);
        setMessages(latestSession.messages);
      } else if (currentSessionId) {
        // Keep current session selected but update the list
        const existingSession = sessionsReversed.find(s => s.id === currentSessionId);
        if (!existingSession) {
          // Current session not in DB yet (new session), keep it in the list
          const newSession = chatSessions.find(s => s.id === currentSessionId);
          if (newSession && newSession.messages.length === 0) {
            setChatSessions(prev => {
              const filtered = sessionsReversed.filter(s => s.id !== currentSessionId);
              return [{ ...newSession, preview: messages[0]?.content.slice(0, 50) || "New conversation" }, ...filtered];
            });
          }
        }
      }
    }
  };

  const saveMessage = async (role: "user" | "assistant", content: string) => {
    await supabase.from("chat_messages").insert({
      user_id: user?.id,
      role,
      content,
    });
  };

  const streamChat = async (userMessage: Message) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-mentor-chat`;
    
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: [...messages, userMessage] }),
    });

    if (resp.status === 429) {
      toast({
        title: "Rate Limit",
        description: "Too many requests. Please try again later.",
        variant: "destructive",
      });
      return "";
    }

    if (resp.status === 402) {
      toast({
        title: "Payment Required",
        description: "Please add credits to continue using the AI mentor.",
        variant: "destructive",
      });
      return "";
    }

    if (!resp.ok || !resp.body) {
      throw new Error("Failed to start stream");
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;
    let assistantContent = "";

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    return assistantContent;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    const isNewSession = messages.length === 0;
    
    // If this is the first message in a new session, update the session preview
    if (isNewSession && currentSessionId) {
      setChatSessions(prev => prev.map(session => 
        session.id === currentSessionId 
          ? { ...session, preview: input.slice(0, 50) + (input.length > 50 ? "..." : "") }
          : session
      ));
    }
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      await saveMessage("user", userMessage.content);
      const assistantContent = await streamChat(userMessage);
      
      if (assistantContent) {
        await saveMessage("assistant", assistantContent);
      }
      
      // Refresh history after sending to get proper session grouping
      await loadChatHistory();
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    // Generate a new unique session ID
    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a new session entry in the sidebar
    const newSession: ChatSession = {
      id: newSessionId,
      date: format(new Date(), "MMM d, yyyy"),
      preview: "New conversation",
      messages: [],
      startTime: new Date()
    };
    
    // Add to sessions list (at the beginning since newest first)
    setChatSessions(prev => [newSession, ...prev]);
    
    // Clear messages and set the new session as current
    setMessages([]);
    setCurrentSessionId(newSessionId);
  };

  const handleLoadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
  };

  const handleClearHistory = async () => {
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("user_id", user?.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to clear history",
        variant: "destructive",
      });
    } else {
      setMessages([]);
      setChatSessions([]);
      setCurrentSessionId(null);
      toast({
        title: "Success",
        description: "Chat history cleared",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)]">
        <div className="flex flex-col md:flex-row gap-4 h-full">
          {/* History Sidebar - Always visible on desktop, collapsible on mobile */}
          <Card className={`${showHistory ? 'flex' : 'hidden md:hidden'} md:flex w-full md:w-80 flex-col`}>
            <CardHeader className="border-b py-3 md:py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <History className="w-4 h-4 md:w-5 md:h-5" />
                  Chat History
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="p-3 md:p-4 space-y-2">
                {chatSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No chat history
                  </p>
                ) : (
                  chatSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleLoadSession(session)}
                      className={`w-full text-left p-3 rounded-lg hover:bg-muted transition-colors ${
                        currentSessionId === session.id ? "bg-muted border border-primary/20" : ""
                      }`}
                    >
                      <p className="text-sm font-medium truncate">{session.preview || "New conversation"}</p>
                      <p className="text-xs text-muted-foreground mt-1">{session.date}</p>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Main Chat Area */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="border-b py-3 md:py-4 px-3 md:px-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 md:w-6 md:h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base md:text-lg">AI Academic Mentor</CardTitle>
                    <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                      Ask me anything about your studies
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowHistory(!showHistory)}
                    className="md:hidden"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNewChat}>
                    <Plus className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">New Chat</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <ScrollArea className="flex-1 p-3 md:p-6" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-8 md:py-12">
                    <Brain className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-base md:text-lg font-semibold mb-2">Welcome to AI Mentor</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto px-4">
                      I'm here to help you with your studies. Ask me about concepts, get study tips,
                      or clarify doubts about your coursework.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2 justify-center px-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInput("Can you explain the concept of machine learning?")}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Explain ML
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInput("What are some effective study techniques?")}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Study Tips
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInput("Help me prepare for my upcoming exam")}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Exam Prep
                      </Button>
                    </div>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] md:max-w-[80%] rounded-lg px-3 py-2 md:px-4 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm md:text-base">{message.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <CardContent className="border-t p-3 md:p-4">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a question..."
                  className="min-h-[50px] md:min-h-[60px] resize-none text-sm md:text-base"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-[50px] w-[50px] md:h-[60px] md:w-[60px]"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
                Press Enter to send, Shift+Enter for new line
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AIMentor;