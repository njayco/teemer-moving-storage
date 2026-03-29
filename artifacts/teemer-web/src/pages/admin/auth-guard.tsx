import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/admin/login" />;
  }

  if (user.role !== "admin") {
    return <Redirect to="/admin/login" />;
  }

  return <>{children}</>;
}
