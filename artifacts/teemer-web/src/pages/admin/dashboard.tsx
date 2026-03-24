import { Link } from "wouter";
import { useGetAdminStats, useListJobs } from "@workspace/api-client-react";
import { 
  LayoutDashboard, Users, Truck, FileText, Settings, Search, Bell, 
  ChevronRight, Activity, DollarSign, Package, MapPin, ArrowRight,
  AlertCircle, Clock, CheckCircle, XCircle, TrendingUp, Navigation
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { data: stats } = useGetAdminStats();
  const { data: jobs } = useListJobs();

  // Safe fallbacks if mock API isn't wired perfectly
  const safeStats = stats || {
    totalActiveJobs: 48, pendingRequests: 12, jobsInTransit: 31, completedToday: 19,
    availableCrews: 22, availableTrucks: 25, revenueToday: 18450,
    weeklyRevenue: [
      { day: "Mon", amount: 12000 }, { day: "Tue", amount: 15000 }, { day: "Wed", amount: 18000 },
      { day: "Thu", amount: 14000 }, { day: "Fri", amount: 21000 }, { day: "Sat", amount: 25000 }, { day: "Sun", amount: 18450 }
    ]
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: Activity, label: "Dispatch Map", active: false },
    { icon: Package, label: "All Jobs", active: false },
    { icon: FileText, label: "Quotes", active: false },
    { icon: Users, label: "Crews", active: false },
    { icon: Truck, label: "Fleet", active: false },
    { icon: Settings, label: "Settings", active: false },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-[#0B132B] text-white flex flex-col hidden lg:flex">
        <div className="h-16 flex items-center px-6 border-b border-white/10 bg-black/20">
          <span className="font-display font-bold text-sm tracking-wide">TEEMER M&S <span className="text-primary text-xs ml-1">OS</span></span>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 px-2">Main Menu</div>
          <nav className="space-y-1">
            {navItems.map(item => (
              <button key={item.label} className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
                item.active ? "bg-primary text-white font-semibold" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}>
                <item.icon className="w-4 h-4 mr-3" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center text-secondary font-semibold text-lg">
            <span className="hidden sm:inline">Operations Control Center</span>
            <span className="sm:hidden">Teemer Moving & Storage Corp. OS</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search ID, Name..." className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <button className="relative text-slate-500 hover:text-secondary">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
              SM
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-sm font-medium mb-1">Total Active Jobs</div>
              <div className="text-3xl font-bold text-secondary">{safeStats.totalActiveJobs}</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-sm font-medium mb-1">Pending Requests</div>
              <div className="text-3xl font-bold text-amber-500 flex items-center">
                {safeStats.pendingRequests} <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">New</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-sm font-medium mb-1">Available Fleet</div>
              <div className="text-3xl font-bold text-secondary">{safeStats.availableTrucks} <span className="text-sm text-slate-400 font-normal">/ 40</span></div>
            </div>
            <div className="bg-gradient-to-br from-primary to-green-600 p-5 rounded-2xl shadow-md text-white">
              <div className="text-green-100 text-sm font-medium mb-1">Revenue Today</div>
              <div className="text-3xl font-bold flex items-center">
                <DollarSign className="w-6 h-6 mr-1 opacity-70" />
                {safeStats.revenueToday.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-secondary">Weekly Revenue</h3>
                <select className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-1 outline-none">
                  <option>This Week</option>
                  <option>Last Week</option>
                </select>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={safeStats.weeklyRevenue}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `$${val/1000}k`} dx={-10} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Line type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={3} dot={{r: 4, fill: '#16a34a', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Live Map Placeholder */}
            <div className="bg-white rounded-2xl border border-slate-200 p-1 flex flex-col shadow-sm">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-secondary">Dispatch Map</h3>
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
              </div>
              <div className="flex-1 bg-slate-100 rounded-b-xl relative overflow-hidden flex items-center justify-center min-h-[300px]">
                <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#cbd5e1 2px, transparent 2px)', backgroundSize: '20px 20px'}}></div>
                <div className="text-center relative z-10">
                  <MapPin className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-500 font-medium text-sm">Interactive Map Integration<br/>(Google Maps / Mapbox)</p>
                </div>
                {/* Mock pins */}
                <div className="absolute top-1/4 left-1/4 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg border-2 border-white shadow-black/20">1</div>
                <div className="absolute bottom-1/3 right-1/3 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg border-2 border-white shadow-black/20">2</div>
              </div>
            </div>

            {/* Jobs Table */}
            <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-lg text-secondary">Recent Jobs</h3>
                <button className="text-sm font-medium text-primary hover:underline flex items-center">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Job ID</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Route</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(jobs || []).slice(0, 5).map((job) => (
                      <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-600">{job.id.substring(0, 8)}</td>
                        <td className="px-6 py-4 font-medium text-secondary">{job.customer || "Pending..."}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-slate-600">
                            <span className="w-16 truncate" title={job.pickupLocation}>{job.pickupLocation}</span>
                            <ArrowRight className="w-3 h-3 mx-2 text-slate-400 shrink-0" />
                            <span className="w-16 truncate" title={job.destination}>{job.destination}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            job.status === "Completed" ? "bg-green-100 text-green-700" :
                            job.status === "In Transit" ? "bg-blue-100 text-blue-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-secondary">${job.estimatedPayout}</td>
                      </tr>
                    ))}
                    {(!jobs || jobs.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                          No recent jobs found. Try creating some from the customer portal.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
