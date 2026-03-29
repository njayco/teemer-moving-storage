import React from "react";
import { Link } from "wouter";
import {
  useGetAdminStats, useListJobs, useListQuoteRequests, useUpdateQuoteStatus,
} from "@workspace/api-client-react";
import {
  LayoutDashboard, Users, Truck, FileText, Settings, Search, Bell,
  ChevronRight, Activity, DollarSign, Package, MapPin, ArrowRight,
  Clock, CheckCircle, TrendingUp, ChevronDown, ChevronUp, Phone, Mail,
  Calendar, Boxes, Home, X,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

type QuoteStatus = "quote_requested" | "deposit_paid" | "booked";

const STATUS_CONFIG: Record<QuoteStatus, { label: string; bg: string; text: string }> = {
  quote_requested: { label: "Quote Requested", bg: "bg-amber-100", text: "text-amber-700" },
  deposit_paid: { label: "Deposit Paid", bg: "bg-blue-100", text: "text-blue-700" },
  booked: { label: "Booked", bg: "bg-green-100", text: "text-green-700" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as QuoteStatus] ?? { label: status, bg: "bg-slate-100", text: "text-slate-600" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function QuoteDetailPanel({ quote, onClose }: { quote: NonNullable<ReturnType<typeof useListQuoteRequests>["data"]>[number]; onClose: () => void }) {
  const qr = quote.quoteRequest!;
  const inventory = (qr.inventory ?? {}) as Record<string, number>;
  const inventoryEntries = Object.entries(inventory).filter(([, v]) => v > 0);

  return (
    <tr>
      <td colSpan={8} className="bg-slate-50 border-b border-slate-200 px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-700 text-sm border-b pb-1">Contact & Move</h4>
            <div className="space-y-1.5 text-sm text-slate-600">
              <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" /> {qr.phone || "—"}</div>
              <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-400" /> {qr.email || "—"}</div>
              <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {qr.moveDate || "—"}</div>
              {qr.arrivalTimeWindow && <div className="text-xs text-slate-400">Arrival: {qr.arrivalTimeWindow}</div>}
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-slate-400 font-medium">From</div>
              <div className="text-slate-700">{qr.pickupAddress || qr.originAddress || "—"}</div>
              {qr.secondStop && <div className="text-xs text-slate-400">2nd stop: {qr.secondStop}</div>}
              <div className="text-xs text-slate-400 font-medium mt-1">To</div>
              <div className="text-slate-700">{qr.dropoffAddress || qr.destinationAddress || "—"}</div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-slate-700 text-sm border-b pb-1">Home & Inventory</h4>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Home className="w-3.5 h-3.5 text-slate-400" />
              <span>{qr.numberOfBedrooms ?? 1} bed · {qr.numberOfLivingRooms ?? 1} living · {qr.isFullyFurnished ? "Fully furnished" : "Partially furnished"}</span>
            </div>
            <div className="flex flex-wrap gap-1 text-xs">
              {qr.hasGarage && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Garage</span>}
              {qr.hasOutdoorFurniture && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Outdoor furn.</span>}
              {qr.hasStairs && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Stairs</span>}
              {qr.hasHeavyItems && <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Heavy items</span>}
              {qr.storageNeeded && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Storage: {qr.storageUnitChoice || "needed"}</span>}
            </div>
            {inventoryEntries.length > 0 && (
              <div className="text-sm">
                <div className="text-xs text-slate-400 font-medium mb-1">Inventory</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {inventoryEntries.map(([item, qty]) => (
                    <div key={item} className="text-slate-600">{item}: <span className="font-medium">{qty}</span></div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Boxes className="w-3.5 h-3.5 text-slate-400" />
              <span>Boxes: {qr.smallBoxes ?? 0} small · {qr.mediumBoxes ?? 0} medium</span>
            </div>
            {qr.additionalNotes && (
              <div className="text-xs text-slate-500 italic bg-slate-100 rounded p-2">"{qr.additionalNotes}"</div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-slate-700 text-sm border-b pb-1">Pricing Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Crew</span>
                <span className="font-medium">{quote.crewSize} movers @ ${quote.hourlyRate}/hr</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Est. hours</span>
                <span className="font-medium">~{quote.estimatedHours} hrs</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Labor</span>
                <span className="font-medium">${(quote.laborSubtotal ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Materials</span>
                <span className="font-medium">${(quote.materialsSubtotal ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 border-t pt-2">
                <span>Total estimate</span>
                <span>${(quote.totalEstimate ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-primary font-semibold">
                <span>Deposit</span>
                <span>${(quote.depositAmount ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <X className="w-3 h-3" /> Collapse
          </button>
        </div>
      </td>
    </tr>
  );
}

function QuotesTab() {
  const { data: quotes = [], refetch } = useListQuoteRequests();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { mutateAsync: updateStatus } = useUpdateQuoteStatus();
  const qc = useQueryClient();

  const handleStatusChange = useCallback(async (id: string, status: QuoteStatus) => {
    setUpdatingId(id);
    try {
      await updateStatus({ id, data: { status } });
      await refetch();
      qc.invalidateQueries({ queryKey: ["getAdminStats"] });
    } finally {
      setUpdatingId(null);
    }
  }, [updateStatus, refetch, qc]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-secondary">Quote Requests</h3>
          <p className="text-sm text-slate-400 mt-0.5">{quotes.length} total · newest first</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 w-6"></th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Move Date</th>
              <th className="px-4 py-3">Bedrooms</th>
              <th className="px-4 py-3">Crew</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Deposit</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotes.map((quote) => {
              const qr = quote.quoteRequest!;
              const isExpanded = expandedId === quote.id;
              return (
                <React.Fragment key={quote.id}>
                  <tr
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : quote.id!)}
                  >
                    <td className="px-4 py-3 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-secondary">{qr.contactName || "—"}</div>
                      <div className="text-xs text-slate-400">{qr.phone} · {qr.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {qr.moveDate
                        ? new Date(qr.moveDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{qr.numberOfBedrooms ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {quote.crewSize ? `${quote.crewSize} × ~${quote.estimatedHours}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-secondary">
                      {quote.totalEstimate != null ? `$${quote.totalEstimate.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-primary">
                      {quote.depositAmount != null ? `$${quote.depositAmount.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={quote.status ?? "quote_requested"}
                        disabled={updatingId === quote.id}
                        onChange={(e) => handleStatusChange(quote.id!, e.target.value as QuoteStatus)}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer disabled:opacity-50"
                      >
                        <option value="quote_requested">Quote Requested</option>
                        <option value="deposit_paid">Deposit Paid</option>
                        <option value="booked">Booked</option>
                      </select>
                    </td>
                  </tr>
                  {isExpanded && (
                    <QuoteDetailPanel
                      quote={quote}
                      onClose={() => setExpandedId(null)}
                    />
                  )}
                </React.Fragment>
              );
            })}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                  No quote requests yet. They will appear here once customers submit the quote form.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats } = useGetAdminStats();
  const { data: jobs } = useListJobs();
  const [activeTab, setActiveTab] = useState<"dashboard" | "quotes">("dashboard");

  const safeStats = stats || {
    totalActiveJobs: 0, pendingRequests: 0, jobsInTransit: 0, completedToday: 0,
    availableCrews: 22, availableTrucks: 25, revenueToday: 0,
    totalQuotes: 0, depositCollected: 0, revenuePipeline: 0,
    weeklyRevenue: [
      { day: "Mon", amount: 0 }, { day: "Tue", amount: 0 }, { day: "Wed", amount: 0 },
      { day: "Thu", amount: 0 }, { day: "Fri", amount: 0 }, { day: "Sat", amount: 0 }, { day: "Sun", amount: 0 },
    ],
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", tab: "dashboard" as const },
    { icon: FileText, label: "Quotes", tab: "quotes" as const },
    { icon: Activity, label: "Dispatch Map", tab: null },
    { icon: Package, label: "All Jobs", tab: null },
    { icon: Users, label: "Crews", tab: null },
    { icon: Truck, label: "Fleet", tab: null },
    { icon: Settings, label: "Settings", tab: null },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <div className="w-64 bg-[#0B132B] text-white flex-col hidden lg:flex">
        <div className="h-16 flex items-center px-6 border-b border-white/10 bg-black/20">
          <span className="font-display font-bold text-sm tracking-wide">TEEMER M&S <span className="text-primary text-xs ml-1">OS</span></span>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 px-2">Main Menu</div>
          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.label}
                onClick={() => item.tab && setActiveTab(item.tab)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === item.tab ? "bg-primary text-white font-semibold" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="w-4 h-4 mr-3" />
                {item.label}
                {item.label === "Quotes" && safeStats.pendingRequests > 0 && (
                  <span className="ml-auto bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {safeStats.pendingRequests > 9 ? "9+" : safeStats.pendingRequests}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="text-secondary font-semibold text-lg hidden sm:block">Operations Control Center</div>
            <div className="flex gap-1 sm:hidden">
              <button onClick={() => setActiveTab("dashboard")} className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${activeTab === "dashboard" ? "bg-primary text-white" : "text-slate-600"}`}>
                Dashboard
              </button>
              <button onClick={() => setActiveTab("quotes")} className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${activeTab === "quotes" ? "bg-primary text-white" : "text-slate-600"}`}>
                Quotes
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search ID, Name..." className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <button className="relative text-slate-500 hover:text-secondary">
              <Bell className="w-5 h-5" />
              {safeStats.pendingRequests > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">SM</div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {activeTab === "dashboard" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-slate-500 text-sm font-medium mb-1">Total Quotes</div>
                  <div className="text-3xl font-bold text-secondary">{safeStats.totalQuotes ?? 0}</div>
                  <div className="text-xs text-amber-500 mt-1 font-medium">{safeStats.pendingRequests} pending</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-slate-500 text-sm font-medium mb-1">Revenue Pipeline</div>
                  <div className="text-3xl font-bold text-secondary">
                    ${(safeStats.revenuePipeline ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">est. total from all quotes</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-slate-500 text-sm font-medium mb-1">Deposits Collected</div>
                  <div className="text-3xl font-bold text-blue-600">
                    ${(safeStats.depositCollected ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">from paid & booked quotes</div>
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
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} dx={-10} />
                        <Tooltip
                          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                          formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                        />
                        <Line type="monotone" dataKey="amount" stroke="#16a34a" strokeWidth={3} dot={{ r: 4, fill: "#16a34a", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-1 flex flex-col shadow-sm">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-secondary">Dispatch Map</h3>
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                  </div>
                  <div className="flex-1 bg-slate-100 rounded-b-xl relative overflow-hidden flex items-center justify-center min-h-[300px]">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#cbd5e1 2px, transparent 2px)", backgroundSize: "20px 20px" }}></div>
                    <div className="text-center relative z-10">
                      <MapPin className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-500 font-medium text-sm">Interactive Map Integration<br />(Google Maps / Mapbox)</p>
                    </div>
                    <div className="absolute top-1/4 left-1/4 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg border-2 border-white shadow-black/20">1</div>
                    <div className="absolute bottom-1/3 right-1/3 bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg border-2 border-white shadow-black/20">2</div>
                  </div>
                </div>

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
                              No recent jobs found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "quotes" && <QuotesTab />}
        </main>
      </div>
    </div>
  );
}
