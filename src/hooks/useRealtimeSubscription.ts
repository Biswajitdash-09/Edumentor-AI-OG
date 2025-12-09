import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

type PostgresEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface SubscriptionConfig {
  table: string;
  event?: PostgresEvent;
  filter?: string;
  onData: (payload: any) => void;
}

export function useRealtimeSubscription(
  configs: SubscriptionConfig[],
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || configs.length === 0) return;

    const channelName = `realtime-${configs.map((c) => c.table).join("-")}-${Date.now()}`;
    let channel = supabase.channel(channelName);

    configs.forEach((config) => {
      channel = channel.on(
        "postgres_changes" as any,
        {
          event: config.event || "*",
          schema: "public",
          table: config.table,
          filter: config.filter,
        },
        (payload) => {
          config.onData(payload);
        }
      );
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`Subscribed to ${channelName}`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [enabled, JSON.stringify(configs.map((c) => ({ table: c.table, event: c.event, filter: c.filter })))]);

  return channelRef.current;
}
