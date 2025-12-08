import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, CameraOff } from "lucide-react";

interface QRCodeScannerProps {
  onScan: (code: string) => void;
  onError?: (error: string) => void;
}

const QRCodeScanner = ({ onScan, onError }: QRCodeScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
        },
        (errorMessage) => {
          // QR code scanning errors are frequent and normal
          console.log("QR scan attempt:", errorMessage);
        }
      );

      setIsScanning(true);
      setHasPermission(true);
    } catch (err) {
      console.error("Error starting scanner:", err);
      setHasPermission(false);
      onError?.("Camera permission denied or not available");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div
        id="qr-reader"
        ref={containerRef}
        className={`w-full rounded-lg overflow-hidden ${!isScanning ? "hidden" : ""}`}
        style={{ minHeight: isScanning ? "300px" : "0" }}
      />

      {!isScanning && (
        <Card className="p-8 text-center bg-muted/50">
          <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">
            Scan the QR code displayed by your instructor
          </p>
          <Button onClick={startScanner}>
            <Camera className="w-4 h-4 mr-2" />
            Start Camera
          </Button>
        </Card>
      )}

      {isScanning && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Point your camera at the QR code
          </p>
          <Button variant="outline" onClick={stopScanner}>
            <CameraOff className="w-4 h-4 mr-2" />
            Stop Camera
          </Button>
        </div>
      )}

      {hasPermission === false && (
        <div className="text-center p-4 bg-destructive/10 rounded-lg">
          <p className="text-sm text-destructive">
            Camera access denied. Please enable camera permissions or enter the code manually.
          </p>
        </div>
      )}
    </div>
  );
};

export default QRCodeScanner;
