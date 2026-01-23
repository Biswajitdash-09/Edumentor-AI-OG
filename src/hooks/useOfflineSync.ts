import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QueuedAttendance {
  id: string;
  sessionId: string;
  qrCode: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  synced: boolean;
}

const QUEUE_KEY = "offline_attendance_queue";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedItems, setQueuedItems] = useState<QueuedAttendance[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Load queue from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      try {
        setQueuedItems(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse offline queue:", e);
      }
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queuedItems));
  }, [queuedItems]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Back Online",
        description: "Syncing pending attendance records...",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "You're Offline",
        description: "Attendance check-ins will be queued and synced when online.",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [toast]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && queuedItems.filter((i) => !i.synced).length > 0) {
      syncQueue();
    }
  }, [isOnline]);

  const addToQueue = useCallback(
    (attendance: Omit<QueuedAttendance, "id" | "synced">) => {
      const newItem: QueuedAttendance = {
        ...attendance,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        synced: false,
      };
      setQueuedItems((prev) => [...prev, newItem]);
      return newItem.id;
    },
    []
  );

  const syncQueue = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    const unsynced = queuedItems.filter((i) => !i.synced);
    if (unsynced.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of unsynced) {
      try {
        // Find the session
        const { data: session } = await supabase
          .from("attendance_sessions")
          .select("*")
          .eq("qr_code", item.qrCode)
          .single();

        if (!session) {
          // Mark as synced (failed) to remove from queue
          setQueuedItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, synced: true } : i))
          );
          failCount++;
          continue;
        }

        // Check if session expired
        if (new Date(session.expires_at) < new Date(item.timestamp)) {
          setQueuedItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, synced: true } : i))
          );
          failCount++;
          continue;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) continue;

        // Record attendance
        const { error } = await supabase.from("attendance_records").insert({
          session_id: session.id,
          student_id: user.id,
          location_lat: item.latitude,
          location_lng: item.longitude,
          status: "present",
        });

        if (!error || error.code === "23505") {
          // Success or already exists
          setQueuedItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, synced: true } : i))
          );
          if (!error) successCount++;
        }
      } catch (e) {
        console.error("Failed to sync attendance:", e);
      }
    }

    setIsSyncing(false);

    // Clean up synced items
    setQueuedItems((prev) => prev.filter((i) => !i.synced));

    if (successCount > 0) {
      toast({
        title: "Sync Complete",
        description: `${successCount} attendance record(s) synced successfully.`,
      });
    }
    if (failCount > 0) {
      toast({
        title: "Some Records Failed",
        description: `${failCount} record(s) could not be synced (expired sessions).`,
        variant: "destructive",
      });
    }
  }, [isSyncing, isOnline, queuedItems, toast]);

  const getPendingCount = useCallback(() => {
    return queuedItems.filter((i) => !i.synced).length;
  }, [queuedItems]);

  return {
    isOnline,
    isSyncing,
    addToQueue,
    syncQueue,
    getPendingCount,
    queuedItems: queuedItems.filter((i) => !i.synced),
  };
}
