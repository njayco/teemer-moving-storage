import { Link, useLocation } from "wouter";
import { type ReactNode } from "react";
import { useCustomerAuth } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Truck,
  CreditCard,
  LogOut,
  User as UserIcon,
} from "lucide-react";

export function CustomerHeader() {
  const { customer, logout } = useCustomerAuth();
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/info" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white font-bold">T</div>
          <div className="leading-tight">
            <p className="font-bold text-slate-900 text-sm">Teemer Moving</p>
            <p className="text-xs text-slate-500 -mt-0.5">My Account</p>
          </div>
        </Link>
        <nav className="hidden sm:flex items-center gap-1">
          <Link href="/account" className="px-3 py-2 text-sm rounded-lg hover:bg-slate-100 text-slate-700">
            Dashboard
          </Link>
          <Link href="/info/quote" className="px-3 py-2 text-sm rounded-lg hover:bg-slate-100 text-slate-700">
            New Quote
          </Link>
        </nav>
        {customer ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-xs text-slate-500">Signed in as</span>
              <span className="font-semibold text-slate-900 text-sm">{customer.username}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => logout().then(() => (window.location.href = "/account/login"))}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        ) : (
          <Link href="/account/login">
            <Button size="sm">Sign in</Button>
          </Link>
        )}
      </div>
    </header>
  );
}

export function CustomerLayout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {title && <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">{title}</h1>}
        {children}
      </div>
    </div>
  );
}

export function CustomerSideNav() {
  const [location] = useLocation();
  const items = [
    { label: "Dashboard", href: "/account", icon: LayoutDashboard },
    { label: "My Quotes", href: "/account#quotes", icon: FileText },
    { label: "My Jobs", href: "/account#jobs", icon: Truck },
    { label: "Payments", href: "/account#payments", icon: CreditCard },
    { label: "Profile", href: "/account#profile", icon: UserIcon },
  ];
  return (
    <aside className="hidden md:block w-56 shrink-0">
      <nav className="space-y-1 sticky top-20">
        {items.map((it) => {
          const Icon = it.icon;
          const active = location === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                active ? "bg-primary text-white" : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" /> {it.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function CustomerAuthGuard({ children }: { children: ReactNode }) {
  const { customer, loading } = useCustomerAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-500">Loading…</div>
      </div>
    );
  }
  if (!customer) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/account/login?next=${next}`;
    return null;
  }
  return <>{children}</>;
}
