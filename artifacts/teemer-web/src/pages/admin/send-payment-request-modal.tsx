import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLookupCustomers,
  useCreateAdminPaymentRequest,
  type AdminCustomerLookup,
} from "@workspace/api-client-react";
import { Search, Send, X, CheckCircle2, AlertCircle, Copy } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SendPaymentRequestModal({ open, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<AdminCustomerLookup | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ payUrl: string | null; id: number } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebounced("");
      setSelected(null);
      setAmount("");
      setDescription("");
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const lookupQ = useLookupCustomers(
    { q: debounced },
    {
      query: {
        queryKey: ["/api/admin/customers/lookup", debounced],
        enabled: debounced.length >= 2 && !selected,
      },
    },
  );

  const createPR = useCreateAdminPaymentRequest({
    mutation: {
      onSuccess: (pr) => {
        setSuccess({ payUrl: pr.payUrl ?? null, id: pr.id ?? 0 });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-requests"] });
      },
      onError: (e: unknown) => {
        const err = e as { error?: string; message?: string };
        setError(err?.error || err?.message || "Failed to create payment request.");
      },
    },
  });

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selected?.id) {
      setError("Pick a customer first.");
      return;
    }
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 1) {
      setError("Enter a valid amount of $1 or more.");
      return;
    }
    if (!description.trim()) {
      setError("Add a short description so the customer knows what they're paying for.");
      return;
    }
    createPR.mutate({
      data: {
        customerId: selected.id,
        amountCents: Math.round(dollars * 100),
        description: description.trim(),
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Send Payment Request</h3>
            <p className="text-sm text-slate-500">Bill a customer for any amount and email them a Stripe pay link.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">Payment request sent!</h4>
            <p className="text-sm text-slate-500 mt-1">
              We've emailed the pay link to {selected?.fullName}.
            </p>
            {success.payUrl && (
              <div className="mt-4 bg-slate-50 rounded-lg p-3 flex items-center gap-2">
                <input
                  readOnly
                  value={success.payUrl}
                  className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(success.payUrl!)}
                  className="text-xs text-primary font-semibold flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Customer</label>
              {selected ? (
                <div className="mt-1 flex items-center justify-between bg-primary/5 border border-primary/30 rounded-lg p-3">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{selected.fullName}</p>
                    <p className="text-xs text-slate-500 font-mono">{selected.username ?? "(no username)"} · {selected.email}</p>
                    {!selected.hasAccount && (
                      <p className="text-[11px] text-amber-700 mt-1">No account yet — they'll get login info via email.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-xs text-slate-500 hover:text-rose-600"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, email, phone, or +username"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  {debounced.length >= 2 && (
                    <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg">
                      {lookupQ.isLoading ? (
                        <p className="p-3 text-xs text-slate-500">Searching…</p>
                      ) : (lookupQ.data ?? []).length === 0 ? (
                        <p className="p-3 text-xs text-slate-400 italic">No customers match.</p>
                      ) : (
                        (lookupQ.data ?? []).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelected(c)}
                            className="w-full text-left p-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                          >
                            <p className="font-medium text-slate-900 text-sm">{c.fullName}</p>
                            <p className="text-xs text-slate-500 font-mono">{c.username ?? "(no username)"} · {c.email}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">Amount (USD)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
                    placeholder="250.00"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="e.g. Final balance for Jan 5 move (overtime + extra crew)"
                className="w-full px-3 py-2 mt-1 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            {error && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createPR.isPending}
                className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                {createPR.isPending ? "Sending…" : "Send Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
