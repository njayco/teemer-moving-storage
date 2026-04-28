import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetAdminStats,
  useListJobs,
  useListQuoteRequests,
  useUpdateQuoteStatus,
  useUpdateJobStatus,
  useGetJob,
  useListUsers,
  useGetAlertEmailSettings,
  useUpdateAlertEmailSettings,
  type QuoteResponse,
  type Job,
} from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Search,
  Bell,
  ChevronRight,
  DollarSign,
  Package,
  ArrowRight,
  Clock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Calendar,
  Boxes,
  Home,
  X,
  AlertCircle,
  Truck,
  UserCheck,
  CreditCard,
  Eye,
  Filter,
  ChevronLeft,
  MapPin,
  Loader2,
  Ban,
  Send,
  Receipt,
  TrendingUp,
  Edit3,
  Building2,
  Settings,
  Plus,
  Trash2,
  Save,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusTimeline } from "@/components/StatusTimeline";
import { useAuth } from "@/lib/auth";

type QuoteStatus = "quote_requested" | "deposit_paid" | "booked";

const STATUS_CONFIG: Record<QuoteStatus, { label: string; bg: string; text: string }> = {
  quote_requested: { label: "Quote Requested", bg: "bg-amber-100", text: "text-amber-700" },
  deposit_paid: { label: "Deposit Paid", bg: "bg-blue-100", text: "text-blue-700" },
  booked: { label: "Booked", bg: "bg-green-100", text: "text-green-700" },
};

const JOB_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "bg-amber-100", text: "text-amber-700" },
  scheduled: { label: "Scheduled", bg: "bg-blue-100", text: "text-blue-700" },
  captain_assigned: { label: "Captain Assigned", bg: "bg-purple-100", text: "text-purple-700" },
  en_route: { label: "En Route", bg: "bg-cyan-100", text: "text-cyan-700" },
  arrived: { label: "Arrived", bg: "bg-teal-100", text: "text-teal-700" },
  in_progress: { label: "In Progress", bg: "bg-orange-100", text: "text-orange-700" },
  at_storage: { label: "At Storage", bg: "bg-indigo-100", text: "text-indigo-700" },
  returning: { label: "Returning", bg: "bg-sky-100", text: "text-sky-700" },
  delayed: { label: "Delayed", bg: "bg-rose-100", text: "text-rose-700" },
  finished: { label: "Finished — Awaiting Payment", bg: "bg-yellow-100", text: "text-yellow-800" },
  awaiting_remaining_balance: { label: "Awaiting Balance", bg: "bg-yellow-100", text: "text-yellow-700" },
  paid_in_cash: { label: "Paid in Cash", bg: "bg-emerald-100", text: "text-emerald-700" },
  complete: { label: "Complete", bg: "bg-green-100", text: "text-green-700" },
  cancelled: { label: "Cancelled", bg: "bg-red-100", text: "text-red-700" },
};

const JOB_STATUS_OPTIONS = [
  "pending", "scheduled", "captain_assigned", "en_route", "arrived", "in_progress",
  "at_storage", "returning", "delayed", "finished", "awaiting_remaining_balance", "paid_in_cash", "complete", "cancelled",
];

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "same_day", label: "Same Day" },
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "captain_assigned", label: "Captain Assigned" },
  { value: "arrived", label: "Arrived" },
  { value: "in_progress", label: "In Progress" },
  { value: "at_storage", label: "At Storage" },
  { value: "en_route", label: "En Route" },
  { value: "returning", label: "Returning" },
  { value: "delayed", label: "Delayed" },
  { value: "finished", label: "Finished" },
  { value: "awaiting_remaining_balance", label: "Awaiting Balance" },
  { value: "paid_in_cash", label: "Paid Cash" },
  { value: "complete", label: "Complete" },
  { value: "cancelled", label: "Cancelled" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as QuoteStatus] ?? { label: status, bg: "bg-slate-100", text: "text-slate-600" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const cfg = JOB_STATUS_CONFIG[status] ?? { label: status, bg: "bg-slate-100", text: "text-slate-600" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    unpaid: { label: "Unpaid", bg: "bg-red-50", text: "text-red-600" },
    deposit_only: { label: "Deposit Only", bg: "bg-amber-50", text: "text-amber-600" },
    invoiced: { label: "Invoiced", bg: "bg-blue-50", text: "text-blue-700" },
    paid_cash: { label: "Paid (Cash)", bg: "bg-green-50", text: "text-green-700" },
    paid: { label: "Paid", bg: "bg-green-50", text: "text-green-700" },
  };
  const cfg = configs[status] ?? { label: status, bg: "bg-slate-50", text: "text-slate-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function InvoiceBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; bg: string; text: string }> = {
    none: { label: "None", bg: "bg-slate-50", text: "text-slate-400" },
    draft: { label: "Draft", bg: "bg-slate-100", text: "text-slate-600" },
    sent: { label: "Sent", bg: "bg-blue-50", text: "text-blue-600" },
    paid: { label: "Paid", bg: "bg-green-50", text: "text-green-700" },
    overdue: { label: "Overdue", bg: "bg-red-50", text: "text-red-600" },
  };
  const cfg = configs[status] ?? { label: status, bg: "bg-slate-50", text: "text-slate-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function InvoiceEditorModal({ jobId, job, onClose, onSaved }: {
  jobId: string;
  job: Job | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [laborHours, setLaborHours] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [travelFee, setTravelFee] = useState(0);
  const [stairFee, setStairFee] = useState(0);
  const [storageFee, setStorageFee] = useState(0);
  const [packingFee, setPackingFee] = useState(0);
  const [extraCharges, setExtraCharges] = useState(0);
  const [discounts, setDiscounts] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Array<{ description: string; quantity: number; unitPrice: number }>>([]);
  const [numTrucks, setNumTrucks] = useState(1);
  const [freeformText, setFreeformText] = useState("");
  const [suppliesItems, setSuppliesItems] = useState<Array<{ name: string; quantity: number; unitPrice: number }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/invoices/${jobId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data && data.editableSnapshot) {
            const snap = data.editableSnapshot;
            setLaborHours(snap.laborHours ?? 0);
            setHourlyRate(snap.hourlyRate ?? 0);
            setTravelFee(snap.travelFee ?? 0);
            setStairFee(snap.stairFee ?? 0);
            setStorageFee(snap.storageFee ?? 0);
            setPackingFee(snap.packingFee ?? 0);
            setExtraCharges(data.extraCharges ?? 0);
            setDiscounts(data.discounts ?? 0);
            setDueDate(data.dueDate ?? "");
            setNotes(snap.notes ?? "");
            setNumTrucks(snap.numTrucks ?? (job?.crewSize ? Math.ceil(job.crewSize / 3) : 1));
            setFreeformText(snap.freeformText ?? "");
            if (Array.isArray(snap.suppliesItems)) {
              setSuppliesItems(snap.suppliesItems.map((s: { name?: string; quantity?: number; unitPrice?: number }) => ({
                name: String(s.name ?? ""),
                quantity: Number(s.quantity ?? 1),
                unitPrice: Number(s.unitPrice ?? 0),
              })));
            }
            if (Array.isArray(snap.items)) {
              setItems(snap.items.map((i: { description?: string; quantity?: number; unitPrice?: number }) => ({
                description: String(i.description ?? ""),
                quantity: Number(i.quantity ?? 1),
                unitPrice: Number(i.unitPrice ?? 0),
              })));
            }
          } else {
            setLaborHours(job?.estimatedHours ?? job?.quoteData?.estimatedHours ?? 0);
            setHourlyRate(job?.hourlyRate ?? job?.quoteData?.hourlyRate ?? 0);
            setExtraCharges(job?.extraCharges ?? 0);
            setDiscounts(job?.discounts ?? 0);
            setNumTrucks(job?.crewSize ? Math.ceil(job.crewSize / 3) : 1);
          }
        }
      } catch (_e) {
        setLaborHours(job?.estimatedHours ?? 0);
        setHourlyRate(job?.hourlyRate ?? 0);
      }
      setLoading(false);
    })();
  }, [jobId, job]);

  const suppliesTotal = suppliesItems.reduce((sum, s) => sum + (s.quantity * s.unitPrice), 0);
  const subtotal = (laborHours * hourlyRate) + travelFee + stairFee + storageFee + packingFee + suppliesTotal;
  const finalTotal = subtotal + extraCharges - discounts;
  const totalPaid = (job?.payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const remainingBalance = Math.max(0, finalTotal - totalPaid);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/invoices/${jobId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laborHours, hourlyRate, travelFee, stairFee, storageFee, packingFee,
          extraCharges, discounts, dueDate: dueDate || undefined, notes, items,
          numTrucks, freeformText, suppliesItems,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save invoice");
      } else {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-lg text-secondary">Edit Invoice</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Number of Trucks</label>
              <input type="number" step="1" min={1} max={10} value={numTrucks} onChange={(e) => setNumTrucks(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Crew Size (read-only)</label>
              <input type="text" value={`${job?.crewSize ?? "—"} movers`} readOnly
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Labor Hours</label>
              <input type="number" step="0.5" value={laborHours} onChange={(e) => setLaborHours(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Hourly Rate ($)</label>
              <input type="number" step="1" value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Travel Fee ($)</label>
              <input type="number" step="1" value={travelFee} onChange={(e) => setTravelFee(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Stair Fee ($)</label>
              <input type="number" step="1" value={stairFee} onChange={(e) => setStairFee(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Storage Fee ($)</label>
              <input type="number" step="1" value={storageFee} onChange={(e) => setStorageFee(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Packing Fee ($)</label>
              <input type="number" step="1" value={packingFee} onChange={(e) => setPackingFee(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Extra Charges ($)</label>
              <input type="number" step="1" value={extraCharges} onChange={(e) => setExtraCharges(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Discounts ($)</label>
              <input type="number" step="1" value={discounts} onChange={(e) => setDiscounts(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Notes (internal)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Free-form Text on Invoice (visible to customer)</label>
            <textarea value={freeformText} onChange={(e) => setFreeformText(e.target.value)} rows={3} maxLength={4000}
              placeholder="Anything you'd like to add to the customer's invoice — special thanks, reminders, payment instructions, etc."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-none" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Packing Supplies (itemized)</label>
              <button
                type="button"
                onClick={() => setSuppliesItems([...suppliesItems, { name: "", quantity: 1, unitPrice: 0 }])}
                className="text-xs text-primary hover:underline font-medium"
              >
                + Add Supply
              </button>
            </div>
            {suppliesItems.length > 0 && (
              <div className="space-y-2">
                {suppliesItems.map((s, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <input
                      type="text"
                      placeholder="Item (e.g. Small box, Tape roll)"
                      value={s.name}
                      onChange={(e) => {
                        const updated = [...suppliesItems];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setSuppliesItems(updated);
                      }}
                      className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      min={1}
                      value={s.quantity}
                      onChange={(e) => {
                        const updated = [...suppliesItems];
                        updated[idx] = { ...updated[idx], quantity: Number(e.target.value) };
                        setSuppliesItems(updated);
                      }}
                      className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      step="0.01"
                      value={s.unitPrice}
                      onChange={(e) => {
                        const updated = [...suppliesItems];
                        updated[idx] = { ...updated[idx], unitPrice: Number(e.target.value) };
                        setSuppliesItems(updated);
                      }}
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    />
                    <span className="text-xs text-slate-500 w-16 text-right pt-2">${(s.quantity * s.unitPrice).toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => setSuppliesItems(suppliesItems.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 pt-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {suppliesItems.length > 0 && (
              <div className="text-right text-xs text-slate-500 mt-2">
                Supplies subtotal: <span className="font-semibold text-slate-700">${suppliesTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Other Line Items</label>
              <button
                type="button"
                onClick={() => setItems([...items, { description: "", quantity: 1, unitPrice: 0 }])}
                className="text-xs text-primary hover:underline font-medium"
              >
                + Add Item
              </button>
            </div>
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setItems(updated);
                      }}
                      className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx] = { ...updated[idx], quantity: Number(e.target.value) };
                        setItems(updated);
                      }}
                      className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx] = { ...updated[idx], unitPrice: Number(e.target.value) };
                        setItems(updated);
                      }}
                      className="w-20 px-2 py-1.5 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-primary/30 outline-none"
                    />
                    <span className="text-xs text-slate-500 w-16 text-right pt-2">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 pt-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal (labor + fees)</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">+ Extra Charges</span>
              <span className="font-medium">${extraCharges.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">- Discounts</span>
              <span className="font-medium text-red-500">-${discounts.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-slate-700 font-bold">Final Total</span>
              <span className="font-bold text-secondary">${finalTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Paid</span>
              <span className="font-medium text-primary">-${totalPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-slate-700 font-bold">Remaining Balance</span>
              <span className="font-bold text-amber-600">${remainingBalance.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
              Save Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, icon: Icon, color = "text-secondary", bgColor = "bg-white" }: {
  label: string; value: string | number; subtext?: string; icon: React.ElementType; color?: string; bgColor?: string;
}) {
  return (
    <div className={`${bgColor} p-5 rounded-2xl border border-slate-200 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-slate-500 text-sm font-medium mb-1">{label}</div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
          {subtext && <div className="text-xs text-slate-400 mt-1">{subtext}</div>}
        </div>
        <div className="p-2 bg-slate-50 rounded-xl">
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}

function QuoteDetailPanel({ quote, onClose }: { quote: QuoteResponse; onClose: () => void }) {
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
            <h4 className="font-semibold text-slate-700 text-sm border-b pb-1">
              {qr.serviceType === "junk_removal" ? "Junk Removal Details" : qr.isCommercial ? "Business & Inventory" : "Home & Inventory"}
            </h4>
            {qr.serviceType === "junk_removal" ? (
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs font-medium capitalize">
                    {(qr.junkLoadSize ?? "").replace(/_/g, " ")} load
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  {(qr.junkStairsFlights ?? 0) > 0 && <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Stairs: {qr.junkStairsFlights} flight(s)</span>}
                  {(qr.junkHeavyItemsCount ?? 0) > 0 && <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Heavy items: {qr.junkHeavyItemsCount}</span>}
                  {qr.junkConstructionDebris && <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Construction debris</span>}
                  {qr.junkSameDay && <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Same-day</span>}
                  {qr.junkHazardousItems && <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Hazardous</span>}
                </div>
              </div>
            ) : qr.isCommercial ? (
              <div className="space-y-1.5 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-medium text-blue-700">{qr.commercialBusinessType || "Commercial"}</span>
                </div>
                {qr.commercialSizeTier && (
                  <div className="text-xs">
                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full capitalize">
                      {qr.commercialSizeTier} space
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                <span>{qr.numberOfBedrooms ?? 1} bed · {qr.numberOfLivingRooms ?? 1} living · {qr.isFullyFurnished ? "Fully furnished" : "Partially furnished"}</span>
              </div>
            )}
            {qr.serviceType !== "junk_removal" && (
              <>
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
              </>
            )}
            {qr.additionalNotes && (
              <div className="text-xs text-slate-500 italic bg-slate-100 rounded p-2">"{qr.additionalNotes}"</div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-slate-700 text-sm border-b pb-1">Pricing Breakdown</h4>
            {qr.serviceType === "junk_removal" ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Base Price</span>
                  <span className="font-medium">${(quote.junkBasePrice ?? 0).toFixed(2)}</span>
                </div>
                {(quote.junkAddonsTotal ?? 0) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Add-ons</span>
                    <span className="font-medium">${(quote.junkAddonsTotal ?? 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-800 border-t pt-2">
                  <span>Total estimate</span>
                  <span>${(quote.totalEstimate ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-orange-600 font-semibold">
                  <span>Deposit</span>
                  <span>${(quote.depositAmount ?? 0).toFixed(2)}</span>
                </div>
              </div>
            ) : (
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
              {(quote.commercialAdjustment ?? 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3 text-blue-500" /> Commercial adj.</span>
                  <span className="font-medium">${(quote.commercialAdjustment ?? 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-800 border-t pt-2">
                <span>Total estimate</span>
                <span>${(quote.totalEstimate ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-primary font-semibold">
                <span>Deposit</span>
                <span>${(quote.depositAmount ?? 0).toFixed(2)}</span>
              </div>
            </div>
            )}
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
  const [moveTypeFilter, setMoveTypeFilter] = useState<"all" | "residential" | "commercial" | "junk_removal">("all");
  const { mutateAsync: updateStatus } = useUpdateQuoteStatus();
  const qc = useQueryClient();

  const handleStatusChange = useCallback(async (id: string, status: QuoteStatus) => {
    setUpdatingId(id);
    try {
      await updateStatus({ id, data: { status } });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    } finally {
      setUpdatingId(null);
    }
  }, [updateStatus, refetch, qc]);

  const filteredQuotes = quotes.filter((q) => {
    if (moveTypeFilter === "all") return true;
    if (moveTypeFilter === "junk_removal") return q.quoteRequest?.serviceType === "junk_removal";
    const isCommercial = q.quoteRequest?.isCommercial || q.quoteRequest?.residentialOrCommercial === "commercial";
    const isJunk = q.quoteRequest?.serviceType === "junk_removal";
    if (isJunk) return false;
    return moveTypeFilter === "commercial" ? isCommercial : !isCommercial;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-lg text-secondary">Quote Requests</h3>
          <p className="text-sm text-slate-400 mt-0.5">{filteredQuotes.length} of {quotes.length} shown</p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "residential", "commercial", "junk_removal"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setMoveTypeFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                moveTypeFilter === f
                  ? (f === "junk_removal" ? "bg-orange-500 text-white border-orange-500" : "bg-primary text-white border-primary")
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {f === "commercial" && <Building2 className="w-3.5 h-3.5" />}
              {f === "residential" && <Home className="w-3.5 h-3.5" />}
              {f === "junk_removal" ? "Junk" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
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
            {filteredQuotes.map((quote) => {
              const qr = quote.quoteRequest!;
              const isExpanded = expandedId === quote.id;
              const isCommercialQuote = qr.isCommercial || qr.residentialOrCommercial === "commercial";
              const isJunkQuote = qr.serviceType === "junk_removal";
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
                      <div className="font-medium text-secondary flex items-center gap-1.5">
                        {qr.contactName || "—"}
                        {isJunkQuote && <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-medium">Junk</span>}
                        {isCommercialQuote && !isJunkQuote && <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-slate-400">{qr.phone} · {qr.email}</div>
                      {isCommercialQuote && !isJunkQuote && qr.commercialBusinessType && (
                        <div className="text-xs text-blue-600 mt-0.5">{qr.commercialBusinessType}</div>
                      )}
                      {isJunkQuote && qr.junkLoadSize && (
                        <div className="text-xs text-orange-600 mt-0.5 capitalize">{(qr.junkLoadSize ?? "").replace(/_/g, " ")} load</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {qr.moveDate
                        ? new Date(qr.moveDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">
                      {isJunkQuote
                        ? <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded capitalize">{(qr.junkLoadSize ?? "").replace(/_/g, " ")}</span>
                        : isCommercialQuote
                        ? <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded capitalize">{qr.commercialSizeTier || "comm."}</span>
                        : (qr.numberOfBedrooms ?? "—")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {isJunkQuote ? <span className="text-xs text-slate-400">N/A</span> : quote.crewSize ? `${quote.crewSize} × ~${quote.estimatedHours}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-secondary">
                      {quote.totalEstimate != null ? `$${quote.totalEstimate.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-primary">
                      {quote.depositAmount != null ? `$${quote.depositAmount.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col gap-1.5">
                        <StatusBadge status={quote.status ?? "quote_requested"} />
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
                      </div>
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
            {filteredQuotes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400 italic">
                  {quotes.length === 0
                    ? "No quote requests yet. They will appear here once customers submit the quote form."
                    : `No ${moveTypeFilter} quotes found.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssignCaptainModal({ jobId, currentCaptainId, onClose, onAssign }: {
  jobId: string; currentCaptainId?: number; onClose: () => void;
  onAssign: (captainId: number, captainName: string) => void;
}) {
  const { data: users = [] } = useListUsers();
  const captains = users.filter((u) => u.role === "move_captain" || u.role === "admin");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-secondary">Assign Captain</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {captains.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No captains found. Create users with the "move_captain" role first.</p>
          )}
          {captains.map((captain) => (
            <button
              key={captain.id}
              onClick={() => onAssign(captain.id, captain.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                captain.id === currentCaptainId
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {captain.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-sm">{captain.name}</div>
                <div className="text-xs text-slate-400">{captain.email} · {captain.role}</div>
              </div>
              {captain.id === currentCaptainId && (
                <CheckCircle className="w-4 h-4 text-primary ml-auto" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ContractRecord {
  id: number;
  jobId: number;
  quoteId: number | null;
  signingToken: string;
  status: string;
  sentAt: string | null;
  customerSignedAt: string | null;
  customerSignatureData: string | null;
  createdAt: string | null;
}

function ContractBadge({ status }: { status: string }) {
  if (status === "signed") return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Signed</span>;
  if (status === "sent") return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Sent</span>;
  return <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">None</span>;
}

function JobDetailPanel({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: job, refetch } = useGetJob(jobId, { query: { queryKey: ["job-detail", jobId] } });
  const { mutateAsync: updateJob } = useUpdateJobStatus();
  const qc = useQueryClient();
  const [showCaptainModal, setShowCaptainModal] = useState(false);
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [contract, setContract] = useState<ContractRecord | null | undefined>(undefined);
  const [contractLoading, setContractLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE || "/api";

  const fetchContract = useCallback(async () => {
    if (!job) return;
    try {
      const res = await fetch(`${API_BASE}/jobs/${job.jobId || jobId}/contract`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setContract(data);
      }
    } catch (_e) {
      setContract(null);
    }
  }, [job, jobId, API_BASE]);

  useEffect(() => {
    if (job) fetchContract();
  }, [job, fetchContract]);

  const handleGenerateContract = async () => {
    if (!confirm("Generate a moving contract and send it to the customer by email?")) return;
    setContractLoading(true);
    try {
      const res = await fetch(`${API_BASE}/jobs/${job?.jobId || jobId}/contracts`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to generate contract");
        return;
      }
      setContract(data);
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
    } finally {
      setContractLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setUpdating(true);
    try {
      await updateJob({ jobId: job?.jobId || jobId, data: { status } });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignCaptain = async (captainId: number, captainName: string) => {
    setUpdating(true);
    try {
      await updateJob({
        jobId: job?.jobId || jobId,
        data: { assignedCaptainId: captainId, assignedMover: captainName, status: "captain_assigned" },
      });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowCaptainModal(false);
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkPaidCash = async () => {
    setUpdating(true);
    try {
      const isFinished = job?.status === "finished" || job?.status === "awaiting_remaining_balance";
      await updateJob({
        jobId: job?.jobId || jobId,
        data: isFinished
          ? { paymentStatus: "paid_cash" }
          : { paymentStatus: "paid_cash", status: "paid_in_cash" },
      });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateActualHours = async (newHours: number) => {
    if (newHours <= 0 || !job) return;
    setUpdating(true);
    try {
      const hourlyRate = job.hourlyRate ?? 0;
      const subtotal = newHours * hourlyRate;
      const extras = job.extraCharges ?? 0;
      const disc = job.discounts ?? 0;
      const newFinalTotal = subtotal + extras - disc;
      await updateJob({
        jobId: job?.jobId || jobId,
        data: { estimatedHours: newHours, finalTotal: newFinalTotal },
      });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkComplete = async () => {
    const bal = job?.remainingBalance ?? 0;
    const ps = job?.paymentStatus;
    if (bal > 0 && ps !== "paid_cash" && ps !== "paid") {
      alert("Cannot mark complete: remaining balance must be $0 or payment must be marked as paid.");
      return;
    }
    setUpdating(true);
    try {
      await updateJob({ jobId: job?.jobId || jobId, data: { status: "complete" } });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark complete");
    } finally {
      setUpdating(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!confirm("Send remaining balance invoice to the customer?")) return;
    setUpdating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE || "/api"}/jobs/${job?.jobId || jobId}/send-invoice`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to send invoice");
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
    } finally {
      setUpdating(false);
    }
  };

  const handleEmailCustomer = async () => {
    const message = prompt("Enter message to send to the customer:");
    if (!message) return;
    setUpdating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE || "/api"}/jobs/${job?.jobId || jobId}/email-customer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "Update from Teemer Moving", message }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to send email");
      await refetch();
    } finally {
      setUpdating(false);
    }
  };

  if (!job) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const qd = job.quoteData;
  const timeline = (job.timeline || []) as Array<{ id: number; eventType: string; statusLabel?: string | null; createdAt?: string | null; notes?: string | null; createdByUserId?: number | null }>;
  const emailLogs = (job.emailLogs || []) as Array<{ id: number; emailType: string; recipient: string; status?: string | null; sentAt?: string | null }>;
  const payments = (job.payments || []) as Array<{ id: number; type: string; method?: string | null; amount: number; paidAt?: string | null; notes?: string | null }>;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto border-l border-slate-200">
        <div className="sticky top-0 bg-white z-10 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-secondary">{job.jobId}</h2>
            <p className="text-sm text-slate-400">{job.customer}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-2 items-center">
            <JobStatusBadge status={job.status || "pending"} />
            <PaymentBadge status={job.paymentStatus || "unpaid"} />
            {job.invoiceStatus && job.invoiceStatus !== "none" && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Invoice: {job.invoiceStatus}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">Move Date</div>
              <div className="text-slate-700">{qd?.moveDate || job.dateTime || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">Arrival Window</div>
              <div className="text-slate-700">{qd?.arrivalTimeWindow || job.arrivalWindow || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">From</div>
              <div className="text-slate-700">{qd?.pickupAddress || job.pickupLocation || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">To</div>
              <div className="text-slate-700">{qd?.dropoffAddress || job.destination || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">Contact</div>
              <div className="text-slate-700">{qd?.phone || "—"}</div>
              <div className="text-xs text-slate-400">{qd?.email || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1">Captain</div>
              <div className="text-slate-700">{job.assignedMover || "Not assigned"}</div>
            </div>
          </div>

          {(job.status === "finished" || job.status === "awaiting_remaining_balance") && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Receipt className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-bold text-yellow-800 text-sm">{job.status === "finished" ? "Job Finished — Balance Due" : "Invoice Sent — Awaiting Payment"}</div>
                  <div className="text-xs text-yellow-700 mt-0.5">{job.status === "finished" ? "Captain marked this job complete. Review actual hours, then send the balance invoice to collect payment." : "Balance invoice has been sent. Adjust hours if needed before payment is collected."}</div>
                  <div className="mt-2 text-lg font-bold text-yellow-900">
                    ${(job.remainingBalance || 0).toFixed(2)} remaining
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1 border-t border-yellow-200">
                <span className="text-xs font-semibold text-yellow-800">Actual Hours Worked</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleUpdateActualHours(Math.max(0.5, (job.estimatedHours ?? 0) - 0.5))}
                    disabled={updating}
                    className="w-7 h-7 rounded-lg bg-yellow-200 hover:bg-yellow-300 text-yellow-800 font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-50"
                  >−</button>
                  <span className="text-base font-bold text-yellow-900 w-12 text-center">{job.estimatedHours ?? "—"}h</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateActualHours((job.estimatedHours ?? 0) + 0.5)}
                    disabled={updating}
                    className="w-7 h-7 rounded-lg bg-yellow-200 hover:bg-yellow-300 text-yellow-800 font-bold text-sm flex items-center justify-center transition-colors disabled:opacity-50"
                  >+</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Crew</span>
              <span className="font-medium">{qd?.crewSize || job.crewSize || "—"} movers · {(job.status === "finished" || job.status === "awaiting_remaining_balance") ? "" : "~"}{(job.status === "finished" || job.status === "awaiting_remaining_balance") ? (job.estimatedHours || qd?.estimatedHours || "—") : (qd?.estimatedHours || job.estimatedHours || "—")} hrs{(job.status === "finished" || job.status === "awaiting_remaining_balance") ? " actual" : " est."}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{job.status === "finished" ? "Final Total" : "Total Estimate"}</span>
              <span className="font-bold text-secondary">${(job.finalTotal || qd?.totalEstimate || job.estimatedPayout || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Deposit Paid</span>
              <span className="font-medium text-primary">${(job.depositPaid || qd?.depositAmount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="text-slate-500 font-medium">Remaining Balance</span>
              <span className="font-bold text-amber-600">${(job.remainingBalance || 0).toFixed(2)}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-secondary text-sm">Admin Actions</h3>
              {updating && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowCaptainModal(true)}
                disabled={updating}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-colors disabled:opacity-50"
              >
                <UserCheck className="w-4 h-4 text-purple-500" /> Assign Captain
              </button>
              <button
                onClick={handleMarkPaidCash}
                disabled={updating || job.paymentStatus === "paid_cash" || job.paymentStatus === "paid"}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <DollarSign className="w-4 h-4 text-green-500" /> Mark Paid (Cash)
              </button>
              <button
                onClick={handleMarkComplete}
                disabled={updating || job.status === "complete" || ((job.remainingBalance ?? 0) > 0 && job.paymentStatus !== "paid" && job.paymentStatus !== "paid_cash")}
                title={((job.remainingBalance ?? 0) > 0 && job.paymentStatus !== "paid" && job.paymentStatus !== "paid_cash") ? "Payment required before completing" : undefined}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4 text-green-600" /> Mark Complete
              </button>
              <button
                onClick={handleSendInvoice}
                disabled={updating || job.invoiceStatus === "paid"}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                <Receipt className="w-4 h-4 text-blue-500" /> {job.status === "finished" || job.status === "awaiting_remaining_balance" ? (job.invoiceStatus === "sent" ? "Resend Balance Invoice" : "Send Balance Invoice") : (job.invoiceStatus === "sent" ? "Resend Invoice" : "Send Invoice")}
              </button>
              <button
                onClick={handleEmailCustomer}
                disabled={updating}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-indigo-500" /> Email Customer
              </button>
              <button
                onClick={() => setShowInvoiceEditor(true)}
                disabled={updating}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                <Edit3 className="w-4 h-4 text-amber-500" /> Edit Invoice
              </button>
              <select
                value={job.status || "pending"}
                disabled={updating}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-primary/30 outline-none disabled:opacity-50"
              >
                {JOB_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{JOB_STATUS_CONFIG[s]?.label || s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-secondary text-sm">Contract</h3>
              {contract && <ContractBadge status={contract.status} />}
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              {contract === undefined && (
                <p className="text-sm text-slate-400 text-center py-1">Loading contract…</p>
              )}
              {contract === null && (
                <p className="text-sm text-slate-400">No contract on file.</p>
              )}
              {contract && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status</span>
                    <ContractBadge status={contract.status} />
                  </div>
                  {contract.sentAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sent</span>
                      <span className="text-slate-700">{new Date(contract.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                  )}
                  {contract.customerSignedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Signed</span>
                      <span className="text-green-700 font-medium">{new Date(contract.customerSignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                  )}
                  {contract.status === "signed" && contract.customerSignatureData && (
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-400 font-medium mb-1">Customer Signature</p>
                      <div className="bg-white border border-slate-200 rounded-lg p-2">
                        <img
                          src={contract.customerSignatureData}
                          alt="Customer signature"
                          className="max-h-16 max-w-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200">
                    <a
                      href={`${API_BASE}/jobs/${job?.jobId || jobId}/contracts/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <FileText className="w-4 h-4" /> Download Contract PDF
                    </a>
                  </div>
                </div>
              )}
              <button
                onClick={handleGenerateContract}
                disabled={contractLoading || updating || !!contract}
                title={contract ? "A contract has already been generated for this job" : "Generate and send contract to customer"}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {contractLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-green-500" />}
                {contract ? "Contract Already Sent" : "Generate & Send Contract"}
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-secondary text-sm mb-3">Status Timeline</h3>
            <StatusTimeline events={timeline} />
          </div>

          {emailLogs.length > 0 && (
            <div>
              <h3 className="font-bold text-secondary text-sm mb-3">Email Log</h3>
              <div className="space-y-2">
                {emailLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg p-3">
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-slate-700">{log.emailType.replace(/_/g, " ")}</div>
                      <div className="text-xs text-slate-400">{log.recipient}</div>
                    </div>
                    <div className="text-xs text-slate-400">
                      {log.sentAt ? new Date(log.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payments.length > 0 && (
            <div>
              <h3 className="font-bold text-secondary text-sm mb-3">Payment History</h3>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg p-3">
                    <CreditCard className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium text-slate-700">{p.type.replace(/_/g, " ")} · {p.method || "—"}</div>
                      {p.notes && <div className="text-xs text-slate-400">{p.notes}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">${p.amount.toFixed(2)}</div>
                      <div className="text-xs text-slate-400">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {job.notes && (
            <div>
              <h3 className="font-bold text-secondary text-sm mb-2">Notes</h3>
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{job.notes}</div>
            </div>
          )}
        </div>
      </div>

      {showCaptainModal && (
        <AssignCaptainModal
          jobId={job.jobId || jobId}
          currentCaptainId={job.assignedCaptainId}
          onClose={() => setShowCaptainModal(false)}
          onAssign={handleAssignCaptain}
        />
      )}

      {showInvoiceEditor && (
        <InvoiceEditorModal
          jobId={job.jobId || jobId}
          job={job}
          onClose={() => setShowInvoiceEditor(false)}
          onSaved={() => {
            refetch();
            qc.invalidateQueries({ queryKey: ["/api/jobs"] });
            qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
          }}
        />
      )}
    </div>
  );
}

function JobsTab({ defaultFilter = "all" }: { defaultFilter?: string }) {
  const [statusFilter, setStatusFilter] = useState(defaultFilter);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const isSameDayFilter = statusFilter === "same_day";

  const { data: rawJobs = [], isLoading } = useListJobs(
    {
      status: !isSameDayFilter && statusFilter !== "all" ? statusFilter : undefined,
      search: searchQuery || undefined,
    },
    { query: { queryKey: ["/api/jobs", isSameDayFilter ? "all" : statusFilter, searchQuery] } },
  );

  const jobs = isSameDayFilter
    ? rawJobs.filter((j) => isToday(j.quoteData?.moveDate ?? j.dateTime))
    : rawJobs;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchTerm);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex flex-wrap gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? "bg-primary text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-primary/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 md:ml-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, job ID, email, phone, invoice..."
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 outline-none w-64"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchTerm(""); setSearchQuery(""); }}
              className="px-3 py-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Captain</th>
                <th className="px-4 py-3">Move Date</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Deposit</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              )}
              {!isLoading && jobs.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400 italic">
                    {searchQuery ? `No jobs found matching "${searchQuery}"` : "No jobs found for this filter."}
                  </td>
                </tr>
              )}
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  onClick={() => setSelectedJobId(job.jobId || job.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{job.jobId || job.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-secondary">{job.customer || "—"}</div>
                    {job.quoteData && (
                      <div className="text-xs text-slate-400">{job.quoteData.phone} · {job.quoteData.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{job.assignedMover || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    <div className="flex items-center gap-1.5">
                      {job.quoteData?.moveDate
                        ? new Date(job.quoteData.moveDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : job.dateTime || "—"}
                      {isToday(job.quoteData?.moveDate ?? job.dateTime) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 leading-none">
                          Today
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="text-slate-600 truncate max-w-[150px]">{job.quoteData?.pickupAddress || job.pickupLocation}</div>
                    <div className="text-slate-400 truncate max-w-[150px]">→ {job.quoteData?.dropoffAddress || job.destination}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-secondary text-xs">
                    ${(job.finalTotal || job.quoteData?.totalEstimate || job.estimatedPayout || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-primary text-xs">
                    ${(job.depositPaid || 0).toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-600 text-xs">
                    ${(job.remainingBalance || 0).toFixed(0)}
                  </td>
                  <td className="px-4 py-3">
                    <JobStatusBadge status={job.status || "pending"} />
                  </td>
                  <td className="px-4 py-3">
                    <PaymentBadge status={job.paymentStatus || "unpaid"} />
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceBadge status={job.invoiceStatus || "none"} />
                  </td>
                  <td className="px-4 py-3">
                    <Eye className="w-4 h-4 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedJobId && (
        <JobDetailPanel jobId={selectedJobId} onClose={() => setSelectedJobId(null)} />
      )}
    </div>
  );
}

function SettingsTab() {
  const { data, refetch } = useGetAlertEmailSettings();
  const { mutate: saveEmails, isPending } = useUpdateAlertEmailSettings();

  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (data?.emails) {
      setEmails(data.emails);
    }
  }, [data?.emails]);

  function addEmail() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (emails.includes(trimmed)) {
      setError("That address is already in the list.");
      return;
    }
    setEmails((prev) => [...prev, trimmed]);
    setNewEmail("");
    setError("");
  }

  function removeEmail(addr: string) {
    setEmails((prev) => prev.filter((e) => e !== addr));
  }

  function handleSave() {
    if (emails.length === 0) {
      setError("At least one email address is required.");
      return;
    }
    setError("");
    saveEmails(
      { data: { emails } },
      {
        onSuccess: () => {
          setSaved(true);
          refetch();
          setTimeout(() => setSaved(false), 3000);
        },
        onError: () => {
          setError("Failed to save. Please try again.");
        },
      }
    );
  }

  return (
    <div className="max-w-xl w-full">
      <h2 className="text-xl font-bold text-secondary mb-1">Alert Settings</h2>
      <p className="text-sm text-slate-500 mb-6">
        Configure which email addresses receive same-day job alerts. Changes take effect immediately — no redeploy needed.
      </p>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-700 mb-2">Same-Day Alert Recipients</div>

          {emails.length === 0 ? (
            <div className="text-sm text-slate-400 italic mb-3">No recipients configured.</div>
          ) : (
            <ul className="space-y-2 mb-3">
              {emails.map((addr) => (
                <li key={addr} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <span className="text-sm text-slate-800 break-all min-w-0">{addr}</span>
                  <button
                    onClick={() => removeEmail(addr)}
                    className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label={`Remove ${addr}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
              placeholder="someone@example.com"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={addEmail}
              className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isPending ? "Saving…" : "Save"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats } = useGetAdminStats();
  const [activeTab, setActiveTab] = useState<"dashboard" | "quotes" | "jobs" | "settings">("dashboard");
  const [jobsFilter, setJobsFilter] = useState("all");
  const { user, logout } = useAuth();

  const { data: allJobs = [] } = useListJobs(
    {},
    { query: { queryKey: ["/api/jobs", "all", ""] } },
  );
  const sameDayCount = allJobs.filter((j) => isToday(j.quoteData?.moveDate ?? j.dateTime)).length;

  const [, setLocation] = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", tab: "dashboard" as const },
    { icon: FileText, label: "Quotes", tab: "quotes" as const },
    { icon: Package, label: "All Jobs", tab: "jobs" as const },
    { icon: Settings, label: "Settings", tab: "settings" as const },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <div className="w-64 bg-[#0B132B] text-white flex-col hidden lg:flex">
        <div className="h-16 flex items-center px-6 border-b border-white/10 bg-black/20">
          <span className="font-display font-bold text-sm tracking-wide">TEEMER M&S <span className="text-primary text-xs ml-1">OS</span></span>
        </div>
        <div className="p-4 flex-1">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 px-2">Main Menu</div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.tab)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === item.tab ? "bg-primary text-white font-semibold" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="w-4 h-4 mr-3" />
                {item.label}
                {item.label === "Quotes" && (stats?.pendingQuotes ?? 0) > 0 && (
                  <span className="ml-auto bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {(stats?.pendingQuotes ?? 0) > 9 ? "9+" : stats?.pendingQuotes}
                  </span>
                )}
                {item.label === "All Jobs" && jobsFilter === "same_day" && (
                  <span className="ml-auto bg-orange-500 text-white text-[10px] rounded px-1.5 py-0.5 font-bold leading-none">
                    Today
                  </span>
                )}
                {item.label === "All Jobs" && jobsFilter !== "same_day" && sameDayCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {sameDayCount > 9 ? "9+" : sameDayCount}
                  </span>
                )}
              </button>
            ))}
            <div className="border-t border-white/10 mt-2 pt-2">
              <button
                onClick={() => setLocation("/admin/revenue")}
                className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <TrendingUp className="w-4 h-4 mr-3" />
                Revenue Report
              </button>
            </div>
          </nav>
        </div>
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-slate-500 mb-2">{user?.email}</div>
          <button
            onClick={logout}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="text-secondary font-semibold text-lg hidden sm:block">Operations Control Center</div>
            <div className="flex gap-0.5 sm:hidden">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setActiveTab(item.tab)}
                  className={`relative flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-colors min-w-[52px] ${
                    activeTab === item.tab ? "bg-primary text-white" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-[10px] font-medium leading-none">
                    {item.label === "All Jobs" ? "Jobs" : item.label}
                  </span>
                  {item.label === "All Jobs" && jobsFilter === "same_day" && (
                    <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] rounded px-1 font-bold leading-none">
                      Today
                    </span>
                  )}
                  {item.label === "All Jobs" && jobsFilter !== "same_day" && sameDayCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                      {sameDayCount > 9 ? "9+" : sameDayCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
              <span>{user?.name}</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{user?.role}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-6">
          {activeTab === "dashboard" && (
            <>
              {sameDayCount > 0 && (
                <button
                  onClick={() => { setJobsFilter("same_day"); setActiveTab("jobs"); }}
                  className="w-full mb-6 flex items-center gap-4 px-5 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-md transition-colors text-left group"
                >
                  <div className="flex-shrink-0 p-2.5 bg-white/20 rounded-xl group-hover:bg-white/30 transition-colors">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-red-100">Same-Day Jobs</div>
                    <div className="text-2xl font-bold leading-tight">
                      {sameDayCount} job{sameDayCount !== 1 ? "s" : ""} scheduled today
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-red-100 text-sm font-medium group-hover:text-white transition-colors">
                    View all <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Jobs" value={stats?.totalJobs ?? 0} icon={Package} />
                <StatCard label="Pending Jobs" value={stats?.pendingJobs ?? 0} icon={Clock} color="text-amber-600" />
                <StatCard label="In Progress" value={stats?.inProgressJobs ?? 0} icon={Truck} color="text-blue-600" />
                <StatCard label="Completed" value={stats?.completedJobs ?? 0} icon={CheckCircle} color="text-green-600" />
                <StatCard label="Total Quotes" value={stats?.totalQuotes ?? 0} icon={FileText} subtext={`${stats?.pendingQuotes ?? 0} pending`} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Deposits Collected" value={`$${(stats?.depositCollected ?? 0).toLocaleString()}`} icon={CreditCard} color="text-primary" />
                <StatCard label="Remaining Balances" value={`$${(stats?.totalRemainingBalance ?? 0).toLocaleString()}`} icon={AlertCircle} color="text-amber-600" />
                <StatCard label="Cash Payments" value={`$${(stats?.cashPayments ?? 0).toLocaleString()}`} icon={DollarSign} color="text-emerald-600" />
                <div className="bg-gradient-to-br from-primary to-green-600 p-5 rounded-2xl shadow-md text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-green-100 text-sm font-medium mb-1">Total Revenue</div>
                      <div className="text-2xl font-bold">${(stats?.totalRevenue ?? 0).toLocaleString()}</div>
                      <div className="text-xs text-green-200 mt-1">from completed jobs</div>
                    </div>
                    <div className="p-2 bg-white/10 rounded-xl">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-secondary">Quick Actions</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setActiveTab("quotes")}
                      className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
                    >
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <div className="text-sm font-medium text-secondary">View Quotes</div>
                        <div className="text-xs text-slate-400">{stats?.totalQuotes ?? 0} total</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setJobsFilter("all"); setActiveTab("jobs"); }}
                      className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
                    >
                      <Package className="w-5 h-5 text-primary" />
                      <div>
                        <div className="text-sm font-medium text-secondary">Manage Jobs</div>
                        <div className="text-xs text-slate-400">{stats?.totalJobs ?? 0} total</div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h3 className="font-bold text-secondary mb-4">Revenue Pipeline</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Total Quote Pipeline</span>
                      <span className="font-bold text-secondary">${(stats?.revenuePipeline ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Deposits Collected</span>
                      <span className="font-bold text-primary">${(stats?.depositCollected ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Total Job Revenue</span>
                      <span className="font-bold text-green-600">${(stats?.totalRevenue ?? 0).toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${stats?.revenuePipeline ? Math.min(100, ((stats?.totalRevenue ?? 0) / stats.revenuePipeline) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "quotes" && <QuotesTab />}
          {activeTab === "jobs" && <JobsTab key={jobsFilter} defaultFilter={jobsFilter} />}
          {activeTab === "settings" && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}
