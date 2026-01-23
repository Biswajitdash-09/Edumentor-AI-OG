import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Wifi, WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NetworkStatus() {
  const { isOnline, isSyncing, syncQueue, getPendingCount } = useOfflineSync();
  const pendingCount = getPendingCount();

  if (isOnline && pendingCount === 0) {
    return null; // Don't show anything when online and synced
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-left-4">
      {!isOnline ? (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-full shadow-lg">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">Offline</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {pendingCount} pending
            </Badge>
          )}
        </div>
      ) : pendingCount > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={syncQueue}
              disabled={isSyncing}
              className="gap-2 shadow-lg"
            >
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CloudOff className="h-4 w-4" />
              )}
              <span>{pendingCount} to sync</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to sync pending attendance records</p>
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
