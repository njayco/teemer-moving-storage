import { Link, useLocation } from "wouter";
import { PackageSearch, Briefcase, MapPin, DollarSign, LogOut, ChevronRight, UserCircle } from "lucide-react";
import { motion } from "framer-motion";

export function PlatformLayout({ children, role }: { children: React.ReactNode, role: "customer" | "provider" }) {
  const [location] = useLocation();

  const customerLinks = [
    { href: "/platform/customer", label: "Dashboard", icon: UserCircle },
    { href: "/platform/customer/track", label: "Track a Job", icon: MapPin },
  ];

  const providerLinks = [
    { href: "/platform/provider", label: "Job Marketplace", icon: PackageSearch },
    { href: "/platform/provider/jobs", label: "My Active Jobs", icon: Briefcase },
    { href: "/platform/provider/earnings", label: "Earnings", icon: DollarSign },
  ];

  const links = role === "customer" ? customerLinks : providerLinks;

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-secondary text-white hidden md:flex flex-col border-r border-slate-800">
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <Link href="/" className="flex items-center text-xl font-bold font-display">
            Teemer Moving & Storage <span className="text-primary ml-2 text-sm font-sans uppercase tracking-wider px-2 py-0.5 bg-primary/20 rounded-md">{role}</span>
          </Link>
        </div>
        <nav className="flex-1 py-8 px-4 space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={`flex items-center px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 font-medium" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? "text-white" : "text-slate-400"}`} />
                {link.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <Link href="/" className="flex items-center px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <LogOut className="w-5 h-5 mr-3" />
            Exit Platform
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-border flex items-center px-8 shadow-sm justify-between md:justify-end">
          {/* Mobile brand (shows only on mobile) */}
          <Link href="/" className="md:hidden font-bold font-display text-xl text-secondary">
            Teemer Moving & Storage <span className="text-primary text-xs">{role}</span>
          </Link>
          
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-secondary font-bold">
              {role === "customer" ? "C" : "P"}
            </div>
            <div className="hidden sm:block text-sm">
              <p className="font-bold text-secondary">{role === "customer" ? "Customer Portal" : "Provider Portal"}</p>
              <p className="text-slate-500">Logged in</p>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
