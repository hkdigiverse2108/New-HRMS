import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { api, getAuthToken, setAuthToken, removeAuthToken, getStoredUser, setStoredUser } from "@/lib/api";
import { toast } from "sonner";
import { API_URL } from "@/lib/config";
import { hasModulePermission } from "@/lib/permissions";

export interface PermissionFlags {
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  all?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  designation?: string;
  profile_photo?: string;
  avatar?: string;
  permissions?: Record<string, PermissionFlags>;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Keep a ref to the latest user object to compare permissions
  const userRef = useRef<UserProfile | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Track in-flight profile fetch to avoid duplicate network calls
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const lastFetchedTimeRef = useRef<number>(0);

  // Sync profile from backend if token exists (deduplicated & throttled)
  const refreshProfile = useCallback(async (silent: boolean = false, force: boolean = false) => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    // If already in flight, return the existing promise so we don't fire duplicate requests
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    // Cooldown: If not forced (e.g., focus/visibility/heartbeat), don't refetch if fetched within last 15 seconds
    const now = Date.now();
    if (!force && now - lastFetchedTimeRef.current < 15000 && userRef.current) {
      setIsLoading(false);
      return;
    }

    const fetchPromise = (async () => {
      try {
        const data = await api.get<UserProfile>("/me", {
          showLoader: false,
          showErrorToast: false,
        });

        lastFetchedTimeRef.current = Date.now();

        if (data && data.id) {
          const prevPermsStr = JSON.stringify(userRef.current?.permissions || {});
          const newPermsStr = JSON.stringify(data.permissions || {});
          const permsChanged = prevPermsStr !== newPermsStr;

          setUser(data);
          setStoredUser(data);

          // If permissions changed live for non-admin, verify if current page is still accessible
          if (permsChanged && data.role !== "Admin" && typeof window !== "undefined") {
            const currentPath = window.location.pathname;
            const safeRoutes = ["/", "/dashboard", "/login", "/profile"];
            if (currentPath && !safeRoutes.includes(currentPath)) {
              const isStillAllowed = hasModulePermission(data, currentPath, "read");
              if (!isStillAllowed) {
                toast.error("Your permissions were updated. You no longer have access to this section.", {
                  id: "perm-revoked",
                  duration: 5000,
                });
                // Safely redirect to dashboard
                window.location.href = "/dashboard";
                return;
              }
            }

            if (!silent) {
              toast.info("Permissions updated in real-time.", { id: "perm-sync", duration: 3000 });
            }
          }
        }
      } catch {
        // If token expired, clear
        removeAuthToken();
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
        inFlightPromiseRef.current = null;
      }
    })();

    inFlightPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, []);

  // 1. Initial Load & Unauthorized handler
  useEffect(() => {
    const currentToken = getAuthToken();
    if (currentToken) {
      try {
        const parts = currentToken.split(".");
        if (parts[1]) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload?.exp && payload.exp * 1000 < Date.now()) {
            removeAuthToken();
            setToken(null);
            setUser(null);
            setIsLoading(false);
            toast.error("Your session has expired. Please log in again.", { id: "session-expired" });
            return;
          }
        }
      } catch {}
    }

    refreshProfile(true);

    const handleUnauthorized = () => {
      removeAuthToken();
      setToken(null);
      setUser(null);
      toast.error("Your session has expired. Please log in again.", { id: "session-expired" });
    };

    window.addEventListener("hrms:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("hrms:unauthorized", handleUnauthorized);
  }, [refreshProfile]);

  // 2. Real-Time Server-Sent Events (SSE) Stream for Live Permission Updates
  useEffect(() => {
    const currentToken = getAuthToken();
    if (!currentToken) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      try {
        const streamUrl = `${API_URL}/permissions/stream?token=${encodeURIComponent(currentToken)}`;
        eventSource = new EventSource(streamUrl);

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data?.type === "PERMISSIONS_UPDATED") {
              const currentUser = userRef.current;
              // If the update targets this employee, their role, or is a global preset update
              if (!data.employee_id || data.employee_id === currentUser?.id || data.role === currentUser?.role) {
                refreshProfile(false);
              }
            }
          } catch {
            // Ignore non-JSON comments or keep-alive pings
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Retry connection after 5 seconds if still authenticated
          if (getAuthToken()) {
            reconnectTimeout = setTimeout(connectSSE, 5000);
          }
        };
      } catch (err) {
        console.warn("SSE connection error", err);
      }
    };

    connectSSE();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [token, refreshProfile]);

  // 3. Multi-Tab & Window Focus Synchronization
  useEffect(() => {
    // Multi-tab sync via BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("hrms_permissions_sync");
      bc.onmessage = (ev) => {
        if (ev.data?.type === "PERMISSIONS_UPDATED") {
          const currentUser = userRef.current;
          if (!ev.data.employee_id || ev.data.employee_id === currentUser?.id) {
            refreshProfile(false);
          }
        }
      };
    } catch {}

    // Auto-sync when user returns to or focuses the window/tab (debounced)
    let debounceTimer: any = null;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          refreshProfile(true);
        }, 300);
      }
    };

    window.addEventListener("focus", onVisibilityChange);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Periodic heartbeat check (every 30 seconds)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && getAuthToken()) {
        refreshProfile(true);
      }
    }, 30000);

    return () => {
      if (bc) bc.close();
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("focus", onVisibilityChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, [refreshProfile]);

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await api.post<{ message: string; email?: string }>(
        "/login",
        { email, password },
        { showErrorToast: false, showLoader: false, skipAuth: true }
      );

      if (res && res.message) {
        return { success: true, message: res.message };
      }
      return { success: false, message: "Failed to initiate login" };
    } catch (err: any) {
      return { success: false, message: err.message || "Invalid credentials. Please check your email and password." };
    }
  };

  const verifyOtp = async (email: string, otp: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await api.post<{ access_token: string; token_type: string }>(
        "/verify-otp",
        { email, otp },
        { showErrorToast: false, showLoader: false, skipAuth: true }
      );

      if (res && res.access_token) {
        setAuthToken(res.access_token);
        setToken(res.access_token);

        // Fetch user profile from /me
        try {
          const profile = await api.get<UserProfile>("/me", {
            showLoader: false,
            showErrorToast: false,
          });
          setUser(profile);
          setStoredUser(profile);
          toast.success(`Welcome back, ${profile.name || "User"}!`);
        } catch {
          const fallbackUser: UserProfile = {
            id: "user-id",
            email,
            name: "Admin User",
            role: "Admin",
          };
          setUser(fallbackUser);
          setStoredUser(fallbackUser);
          toast.success("Welcome back!");
        }

        return { success: true };
      }
      return { success: false, message: "Invalid verification code" };
    } catch (err: any) {
      return { success: false, message: err.message || "Invalid or expired OTP. Please check and try again." };
    }
  };

  const logout = () => {
    removeAuthToken();
    setToken(null);
    setUser(null);
    toast.info("You have been signed out.");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        verifyOtp,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
