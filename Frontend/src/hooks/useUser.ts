export function useUser() {
  const user: any = { id: "admin-1", role: "admin", name: "Admin User", avatar: "https://i.pravatar.cc/150?u=admin" };
  return { user, isLoading: false };
}
