import { PlatformLayout } from "@/components/layout/platform-layout";
import { MapPin, Calendar, DollarSign, Package, ExternalLink, RefreshCw, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";

export default function ProviderPortal() {
  const { user } = useAuth();
  const isAuthenticated = !!user && (user.role === "move_captain" || user.role === "admin");

  const handleAcceptJob = (_jobId: string) => {
    alert("Please sign in as a move captain to accept jobs. Contact Teemer admin for access.");
  };

  return (
    <PlatformLayout role="provider">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Main Feed */}
        <div className="flex-1">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold font-display text-secondary mb-2">Job Marketplace</h1>
              <p className="text-slate-500">Find and claim open moving requests in your area.</p>
            </div>
            <button onClick={() => refetch()} className="p-2 text-slate-400 hover:text-primary transition-colors" title="Refresh Feed">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-8">
            {["All Areas", "Long Island", "NYC", "Local Only", "Long Distance"].map(f => (
              <span key={f} className="px-4 py-2 bg-white border border-border rounded-full text-sm font-medium text-slate-600 cursor-pointer hover:border-primary hover:text-primary transition-colors">
                {f}
              </span>
            ))}
          </div>

          <div className="space-y-6">
            {!isAuthenticated ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-border border-dashed">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-secondary mb-2">Captain Login Required</h3>
                <p className="text-slate-500 mb-4">Sign in as a move captain to view and accept available jobs.</p>
                <a href="/admin/login" className="inline-block px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all">
                  Sign In
                </a>
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-border border-dashed">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-secondary mb-2">No Open Jobs Found</h3>
                <p className="text-slate-500">Check back later or adjust your area filters.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="w-full lg:w-80 space-y-6">
          <div className="bg-secondary text-white p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <h3 className="font-bold font-display text-lg mb-6 relative z-10">Business at a Glance</h3>
            
            <div className="space-y-6 relative z-10">
              <div>
                <p className="text-slate-400 text-sm mb-1">Weekly Earnings</p>
                <p className="text-3xl font-bold text-white">$2,450</p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3">
                  <div className="bg-primary w-2/3 h-full rounded-full"></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-xl">
                  <Clock className="w-5 h-5 text-primary mb-2" />
                  <p className="text-2xl font-bold">3</p>
                  <p className="text-xs text-slate-400">Jobs Today</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-400 mb-2" />
                  <p className="text-2xl font-bold">98%</p>
                  <p className="text-xs text-slate-400">Completion</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-border">
            <h3 className="font-bold text-secondary mb-4">Upcoming Schedule</h3>
            <div className="space-y-4">
              {[1,2].map(i => (
                <div key={i} className="flex items-center border-l-2 border-primary pl-4 py-1">
                  <div>
                    <p className="text-sm font-bold text-secondary">Tomorrow, 8:00 AM</p>
                    <p className="text-xs text-slate-500">Long Beach → Brooklyn</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 text-sm font-semibold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors">
              View Calendar
            </button>
          </div>
        </div>

      </div>
    </PlatformLayout>
  );
}
