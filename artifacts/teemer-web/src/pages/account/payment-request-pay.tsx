import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CustomerLayout, CustomerAuthGuard } from "./layout";
import { customerApi } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, AlertCircle, CreditCard } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface PaymentRequest {
  id: number;
  amountCents: number;
  description: string;
  status: string;
  confirmationNumber: string | null;
  paidAt: string | null;
  createdAt: string | null;
}

function PayContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [error, setError] = useState<string | null>(null);

  const prQ = useQuery({
    queryKey: ["customer-pr", id],
    queryFn: () => customerApi.json<PaymentRequest>(`/customer/payment-requests/${id}`),
  });

  // If user just returned from Stripe, poll for status flip
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") !== "1") return;
    const interval = setInterval(() => prQ.refetch(), 2000);
    const stop = setTimeout(() => clearInterval(interval), 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [prQ]);

  const start = useMutation({
    mutationFn: () =>
      customerApi.json<{ url: string | null }>(`/customer/payment-requests/${id}/checkout`, { method: "POST" }),
    onSuccess: (d) => {
      if (d.url) window.location.href = d.url;
      else setError("Could not get checkout URL.");
    },
    onError: (e: Error) => setError(e.message),
  });

  if (prQ.isLoading) return <CustomerLayout><p className="text-slate-500">Loading…</p></CustomerLayout>;
  if (prQ.error || !prQ.data) {
    return (
      <CustomerLayout>
        <p className="text-rose-600">Couldn't load this payment request.</p>
        <Link href="/account" className="text-primary text-sm">← Back to dashboard</Link>
      </CustomerLayout>
    );
  }

  const pr = prQ.data;
  const amount = pr.amountCents / 100;

  return (
    <CustomerLayout>
      <Link href="/account" className="inline-flex items-center text-sm text-slate-500 hover:text-primary mb-3">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
      </Link>

      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="text-center mb-6">
            <p className="text-xs font-mono text-slate-500">PR-{pr.id}</p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Payment Request</h1>
          </div>

          {pr.status === "paid" ? (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="font-bold text-emerald-700 text-lg">Paid — Thank You!</p>
              {pr.confirmationNumber && (
                <p className="text-sm text-slate-500 mt-1">
                  Confirmation #: <span className="font-mono text-slate-900">{pr.confirmationNumber}</span>
                </p>
              )}
              {pr.paidAt && <p className="text-xs text-slate-500 mt-1">Paid {new Date(pr.paidAt).toLocaleString()}</p>}
            </div>
          ) : (
            <>
              <div className="bg-slate-50 rounded-xl p-5 mb-5 text-center">
                <p className="text-xs uppercase text-slate-500 font-semibold tracking-wide">Amount Due</p>
                <p className="text-4xl font-bold text-slate-900 mt-1">{fmt(amount)}</p>
                <p className="text-sm text-slate-600 mt-2">{pr.description}</p>
              </div>

              {error && (
                <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <Button
                onClick={() => {
                  setError(null);
                  start.mutate();
                }}
                disabled={start.isPending}
                className="w-full bg-primary text-white"
                size="lg"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {start.isPending ? "Redirecting to Stripe…" : `Pay ${fmt(amount)} with Card`}
              </Button>
              <p className="text-center text-xs text-slate-500 mt-3">Secure checkout powered by Stripe</p>
            </>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}

export default function CustomerPaymentRequestPayPage() {
  return (
    <CustomerAuthGuard>
      <PayContent />
    </CustomerAuthGuard>
  );
}
