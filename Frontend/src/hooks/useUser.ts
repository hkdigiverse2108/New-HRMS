import { useAuth } from "@/components/auth/AuthContext";

export function useUser() {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}
