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
  const [isSubscribed, setIsSubscribed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("hrms_notifications_enabled") === "true";
  });
  const [subscriptions, setSubscriptions] = useState<PushSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState("");

  const loadVapidKey = useCallback(async (): Promise<string> => {
    if (vapidPublicKey) return vapidPublicKey;
    try {
      const res = await api.get<VapidPublicKeyResponse>("/push/vapid-public-key", { showErrorToast: false });
      if (res?.public_key) {
        setVapidPublicKey(res.public_key);
        return res.public_key;
      }
    } catch (err) {
      console.error("[Push] Failed to load VAPID key:", err);
    }
    return "";
  }, [vapidPublicKey]);

  const loadSubscriptions = useCallback(async () => {
    try {
      const res = await api.get<PushSubscription[]>("/push/subscriptions", { showErrorToast: false });
      const activeSubs = Array.isArray(res) ? res : [];
      setSubscriptions(activeSubs);
      
      const prefEnabled = localStorage.getItem("hrms_notifications_enabled") !== "false";
      const hasActive = activeSubs.length > 0;
      const permGranted = typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
      setIsSubscribed((hasActive || (permGranted && localStorage.getItem("hrms_notifications_enabled") === "true")) && prefEnabled);
      return activeSubs;
    } catch (err) {
      console.error("[Push] Failed to load subscriptions:", err);
      return [];
    }
  }, []);

  // Check support and permission on mount + auto-sync if granted
  useEffect(() => {
    const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
    setIsSupported(supported);
    
    if (supported) {
      const currentPerm = Notification.permission;
      setPermission(currentPerm);
      
      const prefEnabled = localStorage.getItem("hrms_notifications_enabled") !== "false";
      
      // Auto-sync if user previously enabled or permission is granted
      if (currentPerm === "granted" && prefEnabled) {
        (async () => {
          try {
            const key = await loadVapidKey();
            try {
              await navigator.serviceWorker.register("/sw.js", { scope: "/" });
            } catch (e) {
              console.warn("[Push] Auto-register SW notice:", e);
            }
            const reg = await navigator.serviceWorker.ready;
            let pushSub = await reg.pushManager.getSubscription();
            
            if (!pushSub && key) {
              // Subscribe browser to push
              pushSub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(key),
              });
            }
            
            if (pushSub) {
              const rawP256dh = pushSub.getKey("p256dh");
              const rawAuth = pushSub.getKey("auth");
              if (rawP256dh && rawAuth) {
                const subscriptionData = {
                  endpoint: pushSub.endpoint,
                  p256dh: arrayBufferToBase64(rawP256dh),
                  auth: arrayBufferToBase64(rawAuth),
                };
                await api.post("/push/subscribe", subscriptionData, { showErrorToast: false });
                setIsSubscribed(true);
                localStorage.setItem("hrms_notifications_enabled", "true");
              }
            }
            await loadSubscriptions();
          } catch (e) {
            console.warn("[Push] Auto-sync notice:", e);
          }
        })();
      } else {
        loadSubscriptions();
      }
    }
  }, [loadVapidKey, loadSubscriptions]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser.");
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm === "granted") {
        toast.success("Notification permission granted!");
        return true;
      } else if (perm === "denied") {
        toast.warning("Notifications blocked. Please enable them in browser site settings.");
        return false;
      }
      return false;
    } catch (err) {
      console.error("[Push] Permission request failed:", err);
      toast.error("Failed to request notification permission.");
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async (silent = false): Promise<boolean> => {
    if (!isSupported) {
      if (!silent) toast.error("Push notifications are not supported in this browser.");
      return false;
    }

    let currentKey = vapidPublicKey;
    if (!currentKey) {
      currentKey = await loadVapidKey();
    }
    if (!currentKey) {
      if (!silent) toast.error("Push notification service is temporarily unavailable.");
      return false;
    }

    if (Notification.permission !== "granted") {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    setIsLoading(true);
    try {
      // 1. Ensure service worker is registered
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (swErr) {
        console.warn("[Push] SW register notice:", swErr);
      }
      const registration = await navigator.serviceWorker.ready;
      
      // 2. Check existing or create new push subscription
      let pushSubscription = await registration.pushManager.getSubscription();
      if (!pushSubscription) {
        pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(currentKey),
        });
      }

      const rawP256dh = pushSubscription.getKey("p256dh");
      const rawAuth = pushSubscription.getKey("auth");
      if (!rawP256dh || !rawAuth) {
        throw new Error("Unable to obtain browser push encryption keys.");
      }

      const subscriptionData = {
        endpoint: pushSubscription.endpoint,
        p256dh: arrayBufferToBase64(rawP256dh),
        auth: arrayBufferToBase64(rawAuth),
      };

      await api.post("/push/subscribe", subscriptionData);
      localStorage.setItem("hrms_notifications_enabled", "true");
      setIsSubscribed(true);
      
      if (!silent) toast.success("Push notifications enabled! You will receive alerts even when HRMS is closed.");
      await loadSubscriptions();
      return true;
    } catch (err: any) {
      console.error("[Push] Subscribe failed:", err);
      if (!silent) {
        if (err.name === "AbortError" || err.message?.includes("permission")) {
          toast.error("Permission denied for push notifications.");
        } else {
          toast.error(err.message || "Failed to enable push notifications. Please check site permissions.");
        }
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidPublicKey, loadVapidKey, requestPermission, loadSubscriptions]);

  const unsubscribe = useCallback(async (subscriptionId?: string) => {
    setIsLoading(true);
    try {
      // 1. Unsubscribe from browser PushManager
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
          }
        } catch (be) {
          console.warn("[Push] Browser unsubscribe error:", be);
        }
      }

      // 2. Remove on backend
      if (subscriptionId) {
        await api.delete(`/push/subscriptions/${subscriptionId}`, { showErrorToast: false });
      } else {
        const subs = await loadSubscriptions();
        for (const s of subs) {
          await api.delete(`/push/subscriptions/${s.id}`, { showErrorToast: false });
        }
      }

      localStorage.setItem("hrms_notifications_enabled", "false");
      setIsSubscribed(false);
      toast.success("Notifications turned off.");
      await loadSubscriptions();
    } catch (err) {
      console.error("[Push] Unsubscribe failed:", err);
      toast.error("Failed to remove push subscription.");
    } finally {
      setIsLoading(false);
    }
  }, [loadSubscriptions]);

  const toggleNotifications = useCallback(async (enable: boolean) => {
    if (enable) {
      await subscribe(false);
    } else {
      await unsubscribe();
    }
  }, [subscribe, unsubscribe]);

  const testPush = useCallback(async () => {
    try {
      const res = await api.post<{ sent: number; message: string }>("/push/test");
      if (res.sent > 0) {
        toast.success("Test notification sent! Check your desktop notifications.");
      } else {
        toast.warning(res.message);
      }
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
    toggleNotifications,
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
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}