import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoginPage } from "@/components/auth/LoginPage";
import { useAuth } from "@/components/auth/AuthContext";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — HK DigiVerse HRMS" },
      { name: "description", content: "Sign in to access your organization workspace" },
    ],
  }),
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return <LoginPage />;
}
