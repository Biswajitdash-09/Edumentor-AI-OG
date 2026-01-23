import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // Check if browser supports notifications
    const supported = "Notification" in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      setIsEnabled(Notification.permission === "granted");
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.warn("Push notifications not supported in this browser");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setIsEnabled(result === "granted");
      
      if (result === "granted") {
        // Store preference in localStorage
        localStorage.setItem("push-notifications-enabled", "true");
      }
      
      return result === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isEnabled || !isSupported) return null;

    try {
      const notification = new Notification(title, {
        icon: "/pwa-192x192.png",
        badge: "/favicon.png",
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options?.data?.link) {
          window.location.href = options.data.link;
        }
      };

      return notification;
    } catch (error) {
      console.error("Error sending notification:", error);
      return null;
    }
  }, [isEnabled, isSupported]);

  const disableNotifications = useCallback(() => {
    setIsEnabled(false);
    localStorage.setItem("push-notifications-enabled", "false");
  }, []);

  return {
    isSupported,
    permission,
    isEnabled,
    requestPermission,
    sendNotification,
    disableNotifications,
  };
}
