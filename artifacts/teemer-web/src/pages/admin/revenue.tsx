import React, { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import {
  DollarSign, CreditCard, TrendingUp, Download, Filter,
  ArrowLeft, Calendar, BarChart3, Loader2, Receipt,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface RevenueEntry {
  id: number;
  jobId: string;
  customer: string;
  type: string;
  method: string | null;
  amount: number;
  paidAt: string | null;
  notes: string | null;
  jobStatus: string | null;
}

interface RevenueSummary {
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  depositRevenue: number;
  balanceRevenue: number;
  outstandingReceivables: number;
  transactionCount: number;
}

interface MonthlyData {
  month: string;
  total: number;
}

interface RevenueData {
  summary: RevenueSummary;
  monthlyData: MonthlyData[];
  entries: RevenueEntry[];
}

const API = import.meta.env.VITE_API_BASE || "/api";

function StatCard({ label, value, icon: Icon, color = "text-secondary" }: {
  label: string; value: string | number; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-slate-500 text-sm font-medium mb-1">{label}</div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
        </div>
        <div className="p-2 bg-slate-50 rounded-xl">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function SimpleBarChart({ data }: { data: MonthlyData[] }) {
  if (data.length === 0) return <div className="text-center text-slate-400 py-8">No data for chart</div>;
  const maxVal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="flex items-end gap-2 h-48 px-2">
      {data.map((d) => {
        const height = Math.max((d.total / maxVal) * 100, 4);
        const monthLabel = new Date(d.month + "-15").toLocaleDateString("en-US", { month: "short" });
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-xs text-slate-500 font-medium">${(d.total / 1000).toFixed(1)}k</div>
            <div
              className="w-full bg-gradient-to-t from-primary to-green-500 rounded-t-lg transition-all"
              style={{ height: `${height}%`, minHeight: "4px" }}
            />
            <div className="text-xs text-slate-400">{monthLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function RevenuePage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (methodFilter !== "all") params.set("method", methodFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    return params.toString();
  }, [dateFrom, dateTo, methodFilter, statusFilter]);

  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ["/api/admin/revenue", queryParams],
    queryFn: async () => {
      const res = await fetch(`${API}/admin/revenue?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch revenue");
      return res.json();
    },
  });

  const handleExport = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (methodFilter !== "all") params.set("method", methodFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    window.open(`${API}/admin/revenue/export?${params.toString()}`, "_blank");
  };

  const summary = data?.summary;
  const entries = data?.entries ?? [];
  const monthlyData = data?.monthlyData ?? [];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <div className="w-64 bg-[#0B132B] text-white flex-col hidden lg:flex">
        <div className="h-16 flex items-center px-6 border-b border-white/10 bg-black/20">
          <span className="font-display font-bold text-sm tracking-wide">TEEMER M&S <span className="text-primary text-xs ml-1">OS</span></span>
        </div>
        <div className="p-4 flex-1">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 px-2">Main Menu</div>
          <nav className="space-y-1">
            <button
              onClick={() => setLocation("/admin")}
              className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-3" /> Back to Dashboard
            </button>
            <button className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm bg-primary text-white font-semibold">
              <TrendingUp className="w-4 h-4 mr-3" /> Revenue Report
            </button>
          </nav>
        </div>
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-slate-500 mb-2">{user?.email}</div>
          <button onClick={logout} className="text-xs text-slate-400 hover:text-white transition-colors">Sign Out</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setLocation("/admin")} className="lg:hidden text-slate-400 hover:text-slate-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-secondary font-semibold text-lg">Revenue & Payments Report</div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Filter className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                  placeholder="From"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                  placeholder="To"
                />
              </div>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none bg-white"
              >
                <option value="all">All Methods</option>
                <option value="cash">Cash</option>
                <option value="credit_card">Credit Card</option>
                <option value="stripe">Stripe</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_remaining_balance">Awaiting Balance</option>
                <option value="complete">Complete</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {(dateFrom || dateTo || methodFilter !== "all" || statusFilter !== "all") && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); setMethodFilter("all"); setStatusFilter("all"); }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <StatCard label="Total Revenue" value={`$${(summary?.totalRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-green-600" />
                <StatCard label="Cash" value={`$${(summary?.cashRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} icon={DollarSign} color="text-emerald-600" />
                <StatCard label="Card / Stripe" value={`$${(summary?.cardRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} icon={CreditCard} color="text-blue-600" />
                <StatCard label="Deposits" value={`$${(summary?.depositRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} icon={Receipt} color="text-purple-600" />
                <StatCard label="Balance Payments" value={`$${(summary?.balanceRevenue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} icon={DollarSign} color="text-amber-600" />
                <StatCard label="Outstanding" value={`$${(summary?.outstandingReceivables ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} icon={Receipt} color="text-red-600" />
                <StatCard label="Transactions" value={summary?.transactionCount ?? 0} icon={BarChart3} color="text-secondary" />
              </div>

              {monthlyData.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-secondary text-sm mb-4">Monthly Revenue</h3>
                  <SimpleBarChart data={monthlyData} />
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="font-bold text-secondary text-sm">Payment Transactions ({entries.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Job ID</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3">Job Status</th>
                        <th className="px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                            No payment transactions found for the selected filters.
                          </td>
                        </tr>
                      )}
                      {entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {entry.paidAt ? new Date(entry.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">{entry.jobId ?? "—"}</td>
                          <td className="px-4 py-3 font-medium text-secondary text-xs">{entry.customer}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              entry.type === "deposit" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                            }`}>
                              {entry.type?.replace(/_/g, " ") ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              entry.method === "cash" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
                            }`}>
                              {entry.method?.replace(/_/g, " ") ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">${(entry.amount ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{entry.jobStatus ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">{entry.notes ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
