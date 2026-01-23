import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode, MapPin, Wifi, WifiOff, Check, Camera } from "lucide-react";
import QRCodeScanner from "@/components/QRCodeScanner";

interface OfflineAttendanceCheckInProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function OfflineAttendanceCheckIn({
  open,
  onOpenChange,
  onSuccess,
}: OfflineAttendanceCheckInProps) {
  const [scanCode, setScanCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"pending" | "success" | "error">("pending");
  const { user } = useAuth();
  const { isOnline, addToQueue } = useOfflineSync();
  const { toast } = useToast();

  const handleScan = (code: string) => {
    setScanCode(code);
    setIsScanning(false);
    // Auto-submit after scan
    handleCheckIn(code);
  };

  const handleCheckIn = async (code?: string) => {
    const qrCode = code || scanCode.trim();
    if (!qrCode) {
      toast({
        title: "Error",
        description: "Please enter or scan a QR code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Get location first
    if (!navigator.geolocation) {
      toast({
        title: "Error",
        description: "Geolocation is not supported on this device",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationStatus("success");

        if (isOnline) {
          // Online - check in directly
          try {
            const { data: session } = await supabase
              .from("attendance_sessions")
              .select("*")
              .eq("qr_code", qrCode)
              .single();

            if (!session) {
              toast({
                title: "Error",
                description: "Invalid QR code",
                variant: "destructive",
              });
              setIsLoading(false);
              return;
            }

            if (new Date(session.expires_at) < new Date()) {
              toast({
                title: "Error",
                description: "This attendance session has expired",
                variant: "destructive",
              });
              setIsLoading(false);
              return;
            }

            // Calculate distance
            const { data: distanceData } = await supabase.rpc("calculate_distance", {
              lat1: session.location_lat,
              lng1: session.location_lng,
              lat2: position.coords.latitude,
              lng2: position.coords.longitude,
            });

            if (distanceData > session.geofence_radius) {
              toast({
                title: "Error",
                description: `You are ${Math.round(distanceData)}m away. Maximum allowed: ${session.geofence_radius}m`,
                variant: "destructive",
              });
              setIsLoading(false);
              return;
            }

            // Record attendance
            const { error } = await supabase.from("attendance_records").insert({
              session_id: session.id,
              student_id: user?.id,
              location_lat: position.coords.latitude,
              location_lng: position.coords.longitude,
              status: "present",
            });

            if (error) {
              if (error.code === "23505") {
                toast({
                  title: "Already Checked In",
                  description: "You have already marked attendance for this session",
                });
              } else {
                throw error;
              }
            } else {
              toast({
                title: "Success!",
                description: "Attendance marked successfully",
              });
            }

            onSuccess();
            onOpenChange(false);
          } catch (error: any) {
            toast({
              title: "Error",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          // Offline - queue for later sync
          addToQueue({
            sessionId: "",
            qrCode,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: new Date().toISOString(),
          });

          toast({
            title: "Queued for Sync",
            description: "Your attendance will be submitted when you're back online",
          });

          onSuccess();
          onOpenChange(false);
        }

        setIsLoading(false);
      },
      (error) => {
        setLocationStatus("error");
        toast({
          title: "Location Error",
          description: "Please enable location access to check in",
          variant: "destructive",
        });
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Check In to Class
          </DialogTitle>
          <DialogDescription>
            Scan the QR code or enter the code manually
          </DialogDescription>
        </DialogHeader>

        {/* Network Status */}
        <Card className={isOnline ? "border-green-200 bg-green-50/50 dark:bg-green-950/20" : "border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20"}>
          <CardContent className="p-3 flex items-center gap-3">
            {isOnline ? (
              <>
                <Wifi className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  Online - Check-in will be recorded instantly
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-yellow-700 dark:text-yellow-400">
                  Offline - Check-in will sync when online
                </span>
              </>
            )}
          </CardContent>
        </Card>

        {/* Scanner */}
        {isScanning ? (
          <div className="relative">
            <QRCodeScanner
              onScan={handleScan}
              onError={(error) => {
                toast({
                  title: "Scanner Error",
                  description: error,
                  variant: "destructive",
                });
                setIsScanning(false);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => setIsScanning(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-24 flex flex-col gap-2"
              onClick={() => setIsScanning(true)}
            >
              <Camera className="h-8 w-8" />
              <span>Scan QR Code</span>
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or enter manually
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Attendance Code</Label>
              <Input
                id="code"
                placeholder="e.g., EDU-1234567890-abc123"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            {/* Location Status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Location will be verified on check-in</span>
            </div>

            <Button
              onClick={() => handleCheckIn()}
              disabled={isLoading || !scanCode.trim()}
              className="w-full"
            >
              {isLoading ? (
                "Checking in..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Check In
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
