import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface VapidPublicKeyResponse {
  public_key: string;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState("");

  // Check support and permission on mount
  useEffect(() => {
    const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      loadVapidKey();
      loadSubscriptions();
    }
  }, []);

  const loadVapidKey = async () => {
    try {
      const res = await api.get<VapidPublicKeyResponse>("/push/vapid-public-key", { showErrorToast: false });
      setVapidPublicKey(res.public_key);
    } catch (err) {
      console.error("[Push] Failed to load VAPID key:", err);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const res = await api.get<PushSubscription[]>("/push/subscriptions", { showErrorToast: false });
      setSubscriptions(res);
      setIsSubscribed(res.length > 0);
    } catch (err) {
      console.error("[Push] Failed to load subscriptions:", err);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser.");
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm === "granted") {
        toast.success("Notifications enabled!");
        return true;
      } else if (perm === "denied") {
        toast.warning("Notifications blocked. Please enable them in browser settings.");
        return false;
      }
      return false;
    } catch (err) {
      console.error("[Push] Permission request failed:", err);
      toast.error("Failed to request notification permission.");
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !vapidPublicKey) {
      toast.error("Push notifications not available.");
      return;
    }

    if (permission !== "granted") {
      const granted = await requestPermission();
      if (!granted) return;
    }

    setIsLoading(true);
    try {
      // Register service worker first
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send to backend
      const subscriptionData = {
        endpoint: pushSubscription.endpoint,
        p256dh: arrayBufferToBase64(pushSubscription.getKey("p256dh")!),
        auth: arrayBufferToBase64(pushSubscription.getKey("auth")!),
      };

      await api.post("/push/subscribe", subscriptionData);
      
      toast.success("Push notifications enabled!");
      await loadSubscriptions();
    } catch (err: any) {
      console.error("[Push] Subscribe failed:", err);
      if (err.name === "AbortError" || err.message?.includes("permission")) {
        toast.error("Permission denied for push notifications.");
      } else {
        toast.error("Failed to enable push notifications. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidPublicKey, permission, requestPermission]);

  const unsubscribe = useCallback(async (subscriptionId: string) => {
    setIsLoading(true);
    try {
      await api.delete(`/push/subscriptions/${subscriptionId}`);
      toast.success("Push subscription removed.");
      await loadSubscriptions();
    } catch (err) {
      console.error("[Push] Unsubscribe failed:", err);
      toast.error("Failed to remove push subscription.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const testPush = useCallback(async () => {
    try {
      const res = await api.post<{ sent: number; message: string }>("/push/test");
      toast.success(res.message);
    } catch (err) {
      console.error("[Push] Test push failed:", err);
      toast.error("Failed to send test notification.");
    }
  }, []);

  return {
    isSupported,
    permission,
    isSubscribed,
    subscriptions,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
    testPush,
    loadSubscriptions,
  };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}