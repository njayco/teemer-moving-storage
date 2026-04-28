import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminPayments,
  useListAdminPaymentRequests,
  useRefundAdminPayment,
  useCancelAdminPaymentRequest,
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
  RotateCcw,
  XCircle,
  AlertTriangle,
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
  const [refundTarget, setRefundTarget] = useState<AdminPaymentRow | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const qc = useQueryClient();
  const paymentsKey = ["/api/admin/payments", methodFilter, search] as const;
  const prsKey = ["/api/admin/payment-requests", prStatusFilter] as const;

  const paymentsQ = useListAdminPayments(
    methodFilter || search ? { method: methodFilter || undefined, search: search || undefined } : undefined,
    { query: { queryKey: [...paymentsKey] } },
  );
  const prsQ = useListAdminPaymentRequests(
    prStatusFilter ? { status: prStatusFilter } : undefined,
    { query: { queryKey: [...prsKey] } },
  );

  const cancelM = useCancelAdminPaymentRequest({
    mutation: {
      onSuccess: () => {
        setCancelTargetId(null);
        setCancelError(null);
        qc.invalidateQueries({ queryKey: [...prsKey] });
        qc.invalidateQueries({ queryKey: ["/api/admin/payment-requests"] });
      },
      onError: (err: Error) => {
        setCancelError(err?.message ?? "Could not cancel payment request.");
      },
    },
  });

  const totals = useMemo(() => {
    const rows = (paymentsQ.data ?? []) as AdminPaymentRow[];
    const refundedTotal = rows.reduce((s, p) => s + Number(p.refundedAmount ?? 0), 0);
    return {
      count: rows.length,
      total: rows.reduce((s, p) => s + Number(p.amount ?? 0), 0),
      stripe: rows.filter((p) => p.method === "stripe").reduce((s, p) => s + Number(p.amount ?? 0), 0),
      cash: rows.filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount ?? 0), 0),
      refunded: refundedTotal,
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Payments" value={totals.count.toString()} icon={CreditCard} color="text-primary" />
        <KpiCard label="Total Collected" value={fmt(totals.total)} icon={DollarSign} color="text-emerald-600" />
        <KpiCard label="via Stripe" value={fmt(totals.stripe)} icon={CreditCard} color="text-violet-600" />
        <KpiCard label="via Cash" value={fmt(totals.cash)} icon={DollarSign} color="text-amber-600" />
        <KpiCard label="Refunded" value={fmt(totals.refunded)} icon={RotateCcw} color="text-rose-600" />
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
                      <th className="text-right px-3 py-2">Refunded</th>
                      <th className="text-right px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paymentsQ.data ?? []).map((p) => {
                      const customer = p.customer as
                        | { fullName?: string; email?: string; username?: string | null }
                        | null;
                      const job = p.job as { jobId?: string } | null;
                      const refundedAmount = Number(p.refundedAmount ?? 0);
                      const amount = Number(p.amount ?? 0);
                      const fullyRefunded = refundedAmount > 0 && refundedAmount + 0.001 >= amount;
                      const refundable = p.method === "stripe" && refundedAmount + 0.001 < amount;
                      return (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 align-top">
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
                          <td className="px-3 py-2 text-right font-bold">{fmt(amount)}</td>
                          <td className="px-3 py-2 text-right">
                            {refundedAmount > 0 ? (
                              <div>
                                <div className="font-semibold text-rose-700">−{fmt(refundedAmount)}</div>
                                <div className="text-[10px] uppercase tracking-wide text-rose-500">
                                  {fullyRefunded ? "Fully refunded" : "Partial"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {refundable ? (
                              <button
                                onClick={() => setRefundTarget(p)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 border border-rose-200 hover:border-rose-300 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded"
                              >
                                <RotateCcw className="w-3 h-3" /> Refund
                              </button>
                            ) : p.method === "stripe" && fullyRefunded ? (
                              <span className="text-[10px] uppercase text-slate-400">No balance</span>
                            ) : (
                              <span className="text-[10px] uppercase text-slate-300">—</span>
                            )}
                          </td>
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
                      {pr.status === "pending" && (
                        <div>
                          <button
                            onClick={() => {
                              setCancelError(null);
                              setCancelTargetId(pr.id ?? null);
                            }}
                            disabled={cancelM.isPending}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 border border-rose-200 hover:border-rose-300 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {refundTarget && (
        <RefundModal
          payment={refundTarget}
          onClose={() => setRefundTarget(null)}
          onRefunded={() => {
            setRefundTarget(null);
            qc.invalidateQueries({ queryKey: [...paymentsKey] });
            qc.invalidateQueries({ queryKey: ["/api/admin/payments"] });
          }}
        />
      )}

      {cancelTargetId !== null && (
        <ConfirmCancelModal
          onCancel={() => {
            setCancelTargetId(null);
            setCancelError(null);
          }}
          onConfirm={() => {
            cancelM.mutate({ id: cancelTargetId });
          }}
          isPending={cancelM.isPending}
          error={cancelError}
        />
      )}
    </div>
  );
}

function RefundModal({
  payment,
  onClose,
  onRefunded,
}: {
  payment: AdminPaymentRow;
  onClose: () => void;
  onRefunded: () => void;
}) {
  const amount = Number(payment.amount ?? 0);
  const alreadyRefunded = Number(payment.refundedAmount ?? 0);
  const remaining = Math.max(0, Number((amount - alreadyRefunded).toFixed(2)));
  const [amountInput, setAmountInput] = useState<string>(remaining.toFixed(2));
  const [reason, setReason] = useState<string>("requested_by_customer");
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const refundM = useRefundAdminPayment({
    mutation: {
      onSuccess: () => onRefunded(),
      onError: (err: Error) => setError(err?.message ?? "Refund failed."),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const dollars = Number(amountInput);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a refund amount greater than $0.");
      return;
    }
    if (dollars > remaining + 0.001) {
      setError(`Cannot refund more than ${fmt(remaining)} remaining.`);
      return;
    }
    refundM.mutate({
      id: payment.id ?? 0,
      data: {
        amount: dollars,
        reason: reason as "duplicate" | "fraudulent" | "requested_by_customer",
        notes: notes.trim() || undefined,
      },
    });
  };

  const customer = payment.customer as { fullName?: string; email?: string } | null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-slate-900">Refund Stripe payment</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
            <p className="text-slate-500 text-xs uppercase tracking-wide">Customer</p>
            <p className="font-semibold text-slate-900">{customer?.fullName ?? "—"}</p>
            <p className="text-xs text-slate-500">{customer?.email ?? ""}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-slate-500 uppercase">Charged</p>
                <p className="font-bold">{fmt(amount)}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase">Refunded</p>
                <p className="font-bold text-rose-700">{fmt(alreadyRefunded)}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase">Remaining</p>
                <p className="font-bold text-emerald-700">{fmt(remaining)}</p>
              </div>
            </div>
            {payment.confirmationNumber && (
              <p className="text-[10px] font-mono text-slate-400 mt-2">{payment.confirmationNumber}</p>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Refund amount (USD)</span>
            <div className="mt-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
                required
              />
            </div>
            <button
              type="button"
              onClick={() => setAmountInput(remaining.toFixed(2))}
              className="text-xs text-primary hover:underline mt-1"
            >
              Refund full remaining ({fmt(remaining)})
            </button>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Reason</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="requested_by_customer">Requested by customer</option>
              <option value="duplicate">Duplicate charge</option>
              <option value="fraudulent">Fraudulent</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Internal note (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Why is this refund being issued? (admin only)"
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg p-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={refundM.isPending}
            className="px-3 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={refundM.isPending || remaining <= 0}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {refundM.isPending ? "Refunding…" : "Issue refund"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmCancelModal({
  onCancel,
  onConfirm,
  isPending,
  error,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-slate-900">Cancel payment request?</h3>
        </div>
        <div className="p-5 space-y-3 text-sm text-slate-700">
          <p>
            The customer will no longer be able to pay this request. This cannot be undone — you'd
            need to send a new request.
          </p>
          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg p-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-3 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Keep request
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {isPending ? "Cancelling…" : "Yes, cancel"}
          </button>
        </div>
      </div>
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
    cancelled: { cls: "bg-rose-100 text-rose-700", icon: <XCircle className="w-3 h-3" /> },
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
