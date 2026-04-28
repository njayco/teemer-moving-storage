import { useMemo, useState } from "react";
import {
  useListAdminPayments,
  useListAdminPaymentRequests,
  type AdminPaymentRow,
  type AdminPaymentRequest,
} from "@workspace/api-client-react";
import {
  CreditCard,
  Search,
  DollarSign,
  Send,
  Calendar,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
} from "lucide-react";

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);

interface Props {
  onSendPaymentRequest: () => void;
}

export function PaymentsTab({ onSendPaymentRequest }: Props) {
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [prStatusFilter, setPrStatusFilter] = useState<string>("");
  const [section, setSection] = useState<"payments" | "requests">("payments");

  const paymentsQ = useListAdminPayments(
    methodFilter || search ? { method: methodFilter || undefined, search: search || undefined } : undefined,
    { query: { queryKey: ["/api/admin/payments", methodFilter, search] } },
  );
  const prsQ = useListAdminPaymentRequests(
    prStatusFilter ? { status: prStatusFilter } : undefined,
    { query: { queryKey: ["/api/admin/payment-requests", prStatusFilter] } },
  );

  const totals = useMemo(() => {
    const rows = (paymentsQ.data ?? []) as AdminPaymentRow[];
    return {
      count: rows.length,
      total: rows.reduce((s, p) => s + Number(p.amount ?? 0), 0),
      stripe: rows.filter((p) => p.method === "stripe").reduce((s, p) => s + Number(p.amount ?? 0), 0),
      cash: rows.filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount ?? 0), 0),
    };
  }, [paymentsQ.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-secondary">Payments</h2>
          <p className="text-sm text-slate-500">All deposits, balance payments, and customer payment requests</p>
        </div>
        <button
          onClick={onSendPaymentRequest}
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90"
        >
          <Send className="w-4 h-4" /> Send Payment Request
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Payments" value={totals.count.toString()} icon={CreditCard} color="text-primary" />
        <KpiCard label="Total Collected" value={fmt(totals.total)} icon={DollarSign} color="text-emerald-600" />
        <KpiCard label="via Stripe" value={fmt(totals.stripe)} icon={CreditCard} color="text-violet-600" />
        <KpiCard label="via Cash" value={fmt(totals.cash)} icon={DollarSign} color="text-amber-600" />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {[
          { k: "payments", label: "Payments" },
          { k: "requests", label: "Payment Requests" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setSection(t.k as "payments" | "requests")}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              section === t.k ? "text-primary border-primary" : "text-slate-500 border-transparent hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {section === "payments" ? (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search confirmation #, customer, job ID…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2"
            >
              <option value="">All methods</option>
              <option value="stripe">Stripe</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="zelle">Zelle</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {paymentsQ.isLoading ? (
              <p className="p-6 text-sm text-slate-500">Loading payments…</p>
            ) : paymentsQ.error ? (
              <p className="p-6 text-sm text-rose-600">Failed to load payments.</p>
            ) : (paymentsQ.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-slate-400 italic">No payments match your filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">Confirmation #</th>
                      <th className="text-left px-3 py-2">Customer</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Method</th>
                      <th className="text-left px-3 py-2">Job / PR</th>
                      <th className="text-left px-3 py-2">When</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paymentsQ.data ?? []).map((p) => {
                      const customer = p.customer as
                        | { fullName?: string; email?: string; username?: string | null }
                        | null;
                      const job = p.job as { jobId?: string } | null;
                      return (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-xs">
                            <CopyButton text={p.confirmationNumber ?? `#${p.id}`} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-900">{customer?.fullName ?? "—"}</div>
                            <div className="text-xs text-slate-500">{customer?.username ?? customer?.email ?? ""}</div>
                          </td>
                          <td className="px-3 py-2 capitalize">{(p.type ?? "").replace(/_/g, " ")}</td>
                          <td className="px-3 py-2 capitalize">{p.method ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">
                            {job?.jobId && <span className="text-slate-700 font-mono">{job.jobId}</span>}
                            {p.paymentRequestId && (
                              <span className="text-slate-500">{job?.jobId ? " · " : ""}PR-{p.paymentRequestId}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-500 text-xs">
                            {p.paidAt ? new Date(p.paidAt).toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-bold">{fmt(Number(p.amount ?? 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={prStatusFilter}
              onChange={(e) => setPrStatusFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {prsQ.isLoading ? (
              <p className="p-6 text-sm text-slate-500">Loading payment requests…</p>
            ) : prsQ.error ? (
              <p className="p-6 text-sm text-rose-600">Failed to load.</p>
            ) : (prsQ.data ?? []).length === 0 ? (
              <p className="p-6 text-sm text-slate-400 italic">No payment requests.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(prsQ.data ?? []).map((pr: AdminPaymentRequest) => (
                  <div key={pr.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">PR-{pr.id}</span>
                        <PrStatusBadge status={pr.status ?? "pending"} />
                        {pr.confirmationNumber && (
                          <span className="text-[10px] font-mono text-slate-400">{pr.confirmationNumber}</span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 text-sm">{pr.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        To: {pr.customer?.fullName ?? "—"}{" "}
                        <span className="font-mono">{pr.customer?.username ?? pr.customer?.email ?? ""}</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {pr.createdAt ? new Date(pr.createdAt).toLocaleString() : ""}
                        {pr.paidAt && <span>· Paid {new Date(pr.paidAt).toLocaleString()}</span>}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-bold text-slate-900 text-lg">{fmt((pr.amountCents ?? 0) / 100)}</p>
                      {pr.payUrl && pr.status === "pending" && (
                        <CopyButton text={pr.payUrl} label="Copy Pay Link" icon />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide">{label}</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
    </div>
  );
}

function PrStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    pending: { cls: "bg-amber-100 text-amber-700", icon: <Clock className="w-3 h-3" /> },
    paid: { cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-3 h-3" /> },
    cancelled: { cls: "bg-rose-100 text-rose-700", icon: null },
  };
  const cur = map[status] ?? { cls: "bg-slate-100 text-slate-700", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${cur.cls}`}>
      {cur.icon} {status}
    </span>
  );
}

function CopyButton({ text, label, icon }: { text: string; label?: string; icon?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-primary"
      title="Copy"
    >
      {label ? (
        <>
          {icon && <ExternalLink className="w-3 h-3" />} {copied ? "Copied!" : label}
        </>
      ) : (
        <>
          <span className="font-mono">{text}</span>
          {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
        </>
      )}
    </button>
  );
}
