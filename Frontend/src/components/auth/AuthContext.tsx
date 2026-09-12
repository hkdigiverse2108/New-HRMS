import React, { createContext, useContext, useState, useEffect } from "react";
import { api, getAuthToken, setAuthToken, removeAuthToken, getStoredUser, setStoredUser } from "@/lib/api";
import { toast } from "sonner";

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
  verifyOtp: (email: string, otp: string) => Promise<boolean>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync profile from backend if token exists
  const refreshProfile = async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.get<UserProfile>("/me", {
        showLoader: false,
        showErrorToast: false,
      });
      setUser(data);
      setStoredUser(data);
    } catch {
      // If token expired, clear
      removeAuthToken();
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener("hrms:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("hrms:unauthorized", handleUnauthorized);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await api.post<{ message: string; email?: string }>(
        "/login",
        { email, password },
        { showErrorToast: true, showLoader: true, skipAuth: true }
      );

      if (res && res.message) {
        toast.success(res.message);
        return { success: true, message: res.message };
      }
      return { success: false, message: "Failed to initiate login" };
    } catch (err: any) {
      return { success: false, message: err.message || "Login failed" };
    }
  };

  const verifyOtp = async (email: string, otp: string): Promise<boolean> => {
    try {
      const res = await api.post<{ access_token: string; token_type: string }>(
        "/verify-otp",
        { email, otp },
        { showErrorToast: true, showLoader: true, skipAuth: true }
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

        return true;
      }
      return false;
    } catch (err: any) {
      return false;
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
