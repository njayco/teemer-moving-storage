import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CustomerLayout, CustomerAuthGuard } from "./layout";
import { customerApi } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Download,
  CreditCard,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);

interface JobDetail {
  job: Record<string, unknown>;
  quote: Record<string, unknown> | null;
  invoice: Record<string, unknown> | null;
  payments: Array<Record<string, unknown>>;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    booked: "bg-blue-100 text-blue-700",
    in_progress: "bg-violet-100 text-violet-700",
    finished: "bg-orange-100 text-orange-700",
    awaiting_remaining_balance: "bg-orange-100 text-orange-700",
    complete: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
    paid: "bg-emerald-100 text-emerald-700",
  };
  return <Badge className={`${map[status] ?? "bg-slate-100 text-slate-700"} border-0 text-[10px] uppercase`}>{status.replace(/_/g, " ")}</Badge>;
}

function JobDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailQ = useQuery<JobDetail>({
    queryKey: ["customer-job", id],
    queryFn: () => customerApi.json<JobDetail>(`/customer/jobs/${id}`),
  });

  // Poll for updates if user just returned from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") !== "1") return;
    const interval = setInterval(() => detailQ.refetch(), 2000);
    const stop = setTimeout(() => clearInterval(interval), 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [detailQ]);

  const payBalance = useMutation({
    mutationFn: () => customerApi.json<{ url: string | null }>(`/customer/jobs/${id}/balance-checkout`, { method: "POST" }),
    onSuccess: (d) => {
      if (d.url) window.location.href = d.url;
      else setError("Could not get checkout URL.");
      setPaying(false);
    },
    onError: (e: Error) => {
      setError(e.message);
      setPaying(false);
    },
  });

  if (detailQ.isLoading) return <CustomerLayout><p className="text-slate-500">Loading…</p></CustomerLayout>;
  if (detailQ.error || !detailQ.data) {
    return (
      <CustomerLayout>
        <p className="text-rose-600">Couldn't load this job.</p>
        <Link href="/account" className="text-primary text-sm">← Back to dashboard</Link>
      </CustomerLayout>
    );
  }

  const { job, quote, invoice, payments } = detailQ.data;
  const status = String(job.status ?? "booked");
  const paymentStatus = String(job.paymentStatus ?? "");
  const remaining = Number(job.remainingBalance ?? 0);
  const total = Number(job.finalTotal ?? quote?.totalEstimate ?? 0);
  const deposit = Number(job.depositPaid ?? 0);

  const justPaid = new URLSearchParams(window.location.search).get("paid") === "1";

  return (
    <CustomerLayout>
      <Link href="/account" className="inline-flex items-center text-sm text-slate-500 hover:text-primary mb-3">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
      </Link>

      {justPaid && remaining === 0 && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-900">Payment successful — thank you!</p>
            <p className="text-sm text-emerald-700">A receipt has been emailed to you.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-mono text-slate-500">JOB-{id}</p>
          <h1 className="text-2xl font-bold text-slate-900">My Move</h1>
          <div className="flex gap-2 mt-1">{statusBadge(status)}{paymentStatus && statusBadge(paymentStatus)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`${customerApi.base}/customer/jobs/${id}/contract.pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline"><Download className="w-4 h-4 mr-1" /> Contract PDF</Button>
          </a>
          {invoice && (
            <a
              href={`${customerApi.base}/customer/invoices/${id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline"><Download className="w-4 h-4 mr-1" /> Invoice PDF</Button>
            </a>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card icon={<Calendar className="w-4 h-4 text-primary" />} label="Move Date" value={String(quote?.moveDate ?? "—")} extra={String(job.arrivalWindow ?? quote?.arrivalTimeWindow ?? "")} />
        <Card icon={<Clock className="w-4 h-4 text-primary" />} label="Estimated Hours" value={`${job.estimatedHours ?? "—"} hrs`} extra={`Crew of ${job.crewSize ?? "—"}`} />
        <Card icon={<MapPin className="w-4 h-4 text-emerald-600" />} label="Pickup" value={String(job.originAddress ?? quote?.pickupAddress ?? "—")} />
        <Card icon={<MapPin className="w-4 h-4 text-rose-600" />} label="Dropoff" value={String(job.destinationAddress ?? quote?.dropoffAddress ?? "—")} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="font-bold text-slate-900 mb-4">Charges Summary</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Total" value={fmt(total)} />
          <Row label="Deposit Paid" value={`-${fmt(deposit)}`} />
          <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-bold">
            <dt className="text-slate-900">Remaining Balance</dt>
            <dd className={remaining > 0 ? "text-orange-600" : "text-emerald-600"}>{fmt(remaining)}</dd>
          </div>
        </dl>
        {remaining > 0 && status !== "cancelled" && (
          <div className="mt-4">
            {error && (
              <div className="mb-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
            <Button
              onClick={() => {
                setError(null);
                setPaying(true);
                payBalance.mutate();
              }}
              disabled={paying || payBalance.isPending}
              className="bg-primary text-white"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {paying || payBalance.isPending ? "Redirecting…" : `Pay Remaining ${fmt(remaining)}`}
            </Button>
          </div>
        )}
      </div>

      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Payments on this Job</h3>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="text-left py-2">Confirmation #</th><th className="text-left py-2">Type</th><th className="text-left py-2">When</th><th className="text-right py-2">Amount</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={String(p.id)} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs">{(p.confirmationNumber as string) ?? `#${p.id}`}</td>
                  <td className="py-2 capitalize">{String(p.type ?? "").replace(/_/g, " ")}</td>
                  <td className="py-2 text-slate-500">{p.paidAt ? new Date(p.paidAt as string).toLocaleString() : "—"}</td>
                  <td className="py-2 text-right font-semibold">{fmt(Number(p.amount ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CustomerLayout>
  );
}

function Card({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: string; extra?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-slate-500 font-semibold tracking-wide">{icon} {label}</div>
      <p className="text-slate-900 font-semibold mt-1 break-words">{value}</p>
      {extra && <p className="text-xs text-slate-500 mt-0.5">{extra}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900 font-medium">{value}</dd>
    </div>
  );
}

export default function CustomerJobDetailPage() {
  return (
    <CustomerAuthGuard>
      <JobDetailContent />
    </CustomerAuthGuard>
  );
}
