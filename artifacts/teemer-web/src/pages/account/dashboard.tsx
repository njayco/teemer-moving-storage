import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CustomerLayout, CustomerAuthGuard } from "./layout";
import { customerApi, useCustomerAuth } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Truck,
  CreditCard,
  ChevronRight,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  AlertCircle,
  MailWarning,
  CheckCircle2,
} from "lucide-react";

interface QuoteSummary {
  id: string;
  status: string;
  contactName: string;
  moveDate: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalEstimate: number | null;
  depositAmount: number | null;
  createdAt: string | null;
}
interface JobSummary {
  id: string;
  jobId: string;
  status: string;
  paymentStatus: string | null;
  moveDate: string | null;
  arrivalWindow: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  finalTotal: number | null;
  depositPaid: number | null;
  remainingBalance: number | null;
  createdAt: string | null;
}
interface PaymentRequest {
  id: number;
  amountCents: number;
  description: string;
  status: string;
  createdAt: string | null;
}
interface CustomerPayment {
  id: number;
  jobId: number | null;
  amount: number;
  type: string;
  method: string | null;
  confirmationNumber: string | null;
  paymentRequestId: number | null;
  paidAt: string | null;
}

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);

function statusBadge(status: string) {
  const map: Record<string, string> = {
    quote_requested: "bg-amber-100 text-amber-700",
    booked: "bg-blue-100 text-blue-700",
    in_progress: "bg-violet-100 text-violet-700",
    finished: "bg-orange-100 text-orange-700",
    awaiting_remaining_balance: "bg-orange-100 text-orange-700",
    complete: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
    paid: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-700";
  return (
    <Badge className={`${cls} border-0 text-[10px] tracking-wide uppercase`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function CustomerDashboardContent() {
  const { customer, refresh } = useCustomerAuth();
  const [tab, setTab] = useState<"overview" | "quotes" | "jobs" | "payments" | "profile">("overview");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const resendVerification = async () => {
    setResendState("sending");
    try {
      const res = await customerApi.fetch("/customer-auth/resend-verification", { method: "POST" });
      if (res.ok) {
        setResendState("sent");
        refresh().catch(() => {});
      } else {
        setResendState("error");
      }
    } catch {
      setResendState("error");
    }
  };

  // Sync from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "quotes" || hash === "jobs" || hash === "payments" || hash === "profile") {
      setTab(hash);
    }
  }, []);

  const quotesQ = useQuery({
    queryKey: ["customer-quotes"],
    queryFn: () => customerApi.json<QuoteSummary[]>("/customer/quotes"),
  });
  const jobsQ = useQuery({
    queryKey: ["customer-jobs"],
    queryFn: () => customerApi.json<JobSummary[]>("/customer/jobs"),
  });
  const prQ = useQuery({
    queryKey: ["customer-payment-requests"],
    queryFn: () => customerApi.json<PaymentRequest[]>("/customer/payment-requests"),
  });
  const paymentsQ = useQuery({
    queryKey: ["customer-payments"],
    queryFn: () => customerApi.json<CustomerPayment[]>("/customer/payments"),
  });

  const pendingPRs = useMemo(
    () => (prQ.data ?? []).filter((p) => p.status === "pending"),
    [prQ.data],
  );
  const balanceJobs = useMemo(
    () => (jobsQ.data ?? []).filter((j) => (j.remainingBalance ?? 0) > 0),
    [jobsQ.data],
  );

  return (
    <CustomerLayout>
      <div className="mb-6">
        <p className="text-slate-500 text-sm">Welcome back,</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{customer?.fullName}</h1>
        <p className="text-slate-500 text-sm mt-1 font-mono">{customer?.username}</p>
      </div>

      {customer && customer.emailVerified === false && (
        <div className="mb-4 bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
          {resendState === "sent" ? (
            <CheckCircle2 className="w-5 h-5 text-sky-700 mt-0.5 shrink-0" />
          ) : (
            <MailWarning className="w-5 h-5 text-sky-700 mt-0.5 shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-semibold text-sky-900">
              {resendState === "sent" ? "Verification email sent" : "Verify your email address"}
            </p>
            <p className="text-sm text-sky-800">
              {resendState === "sent"
                ? `We just sent a fresh verification link to ${customer.email}. Click it to confirm your address.`
                : `We sent a verification link to ${customer.email}. Click it to confirm your address.`}
            </p>
            {resendState === "error" && (
              <p className="text-xs text-rose-700 mt-1">Couldn't send the email. Please try again.</p>
            )}
          </div>
          {resendState !== "sent" && (
            <Button
              size="sm"
              variant="outline"
              onClick={resendVerification}
              disabled={resendState === "sending"}
            >
              {resendState === "sending" ? "Sending…" : "Resend"}
            </Button>
          )}
        </div>
      )}

      {(pendingPRs.length > 0 || balanceJobs.length > 0) && (
        <div className="mb-6 space-y-2">
          {pendingPRs.map((pr) => (
            <div key={pr.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Payment Request: {fmt(pr.amountCents / 100)}</p>
                <p className="text-sm text-amber-700">{pr.description}</p>
              </div>
              <Link href={`/account/payment-requests/${pr.id}/pay`}>
                <Button size="sm">Pay Now</Button>
              </Link>
            </div>
          ))}
          {balanceJobs.map((job) => (
            <div key={job.id} className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-orange-900">
                  Outstanding Balance: {fmt(job.remainingBalance)} ({job.jobId})
                </p>
                <p className="text-sm text-orange-700">Move: {job.moveDate ?? "—"}</p>
              </div>
              <Link href={`/account/jobs/${job.id}`}>
                <Button size="sm">View Job</Button>
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => setTab("quotes")}
          className={`text-left p-4 rounded-xl border transition ${tab === "quotes" ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-primary/40"}`}
        >
          <FileText className="w-5 h-5 text-primary mb-2" />
          <p className="text-xs text-slate-500">Saved Quotes</p>
          <p className="text-2xl font-bold text-slate-900">{quotesQ.data?.length ?? 0}</p>
        </button>
        <button
          onClick={() => setTab("jobs")}
          className={`text-left p-4 rounded-xl border transition ${tab === "jobs" ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-primary/40"}`}
        >
          <Truck className="w-5 h-5 text-primary mb-2" />
          <p className="text-xs text-slate-500">My Jobs</p>
          <p className="text-2xl font-bold text-slate-900">{jobsQ.data?.length ?? 0}</p>
        </button>
        <button
          onClick={() => setTab("payments")}
          className={`text-left p-4 rounded-xl border transition ${tab === "payments" ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-primary/40"}`}
        >
          <CreditCard className="w-5 h-5 text-primary mb-2" />
          <p className="text-xs text-slate-500">Payments</p>
          <p className="text-2xl font-bold text-slate-900">{paymentsQ.data?.length ?? 0}</p>
        </button>
        <button
          onClick={() => setTab("profile")}
          className={`text-left p-4 rounded-xl border transition ${tab === "profile" ? "border-primary bg-primary/5" : "border-slate-200 bg-white hover:border-primary/40"}`}
        >
          <DollarSign className="w-5 h-5 text-primary mb-2" />
          <p className="text-xs text-slate-500">Open Balance</p>
          <p className="text-2xl font-bold text-slate-900">
            {fmt((jobsQ.data ?? []).reduce((s, j) => s + (j.remainingBalance ?? 0), 0))}
          </p>
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {[
          { k: "overview", label: "Overview" },
          { k: "quotes", label: "Quotes" },
          { k: "jobs", label: "Jobs" },
          { k: "payments", label: "Payments" },
          { k: "profile", label: "Profile" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as typeof tab)}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t.k ? "text-primary border-primary" : "text-slate-500 border-transparent hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard title="Recent Quotes" link={{ label: "View all", onClick: () => setTab("quotes") }}>
            {(quotesQ.data ?? []).slice(0, 3).map((q) => (
              <QuoteRow key={q.id} q={q} />
            ))}
            {(!quotesQ.data || quotesQ.data.length === 0) && <Empty text="No saved quotes yet." />}
          </SectionCard>
          <SectionCard title="Recent Jobs" link={{ label: "View all", onClick: () => setTab("jobs") }}>
            {(jobsQ.data ?? []).slice(0, 3).map((j) => (
              <JobRow key={j.id} j={j} />
            ))}
            {(!jobsQ.data || jobsQ.data.length === 0) && <Empty text="No jobs yet." />}
          </SectionCard>
        </div>
      )}

      {tab === "quotes" && (
        <div className="space-y-2">
          {(quotesQ.data ?? []).map((q) => <QuoteRow key={q.id} q={q} />)}
          {(!quotesQ.data || quotesQ.data.length === 0) && <Empty text="No saved quotes yet." />}
        </div>
      )}

      {tab === "jobs" && (
        <div className="space-y-2">
          {(jobsQ.data ?? []).map((j) => <JobRow key={j.id} j={j} />)}
          {(!jobsQ.data || jobsQ.data.length === 0) && <Empty text="No jobs yet." />}
        </div>
      )}

      {tab === "payments" && <PaymentsTab payments={paymentsQ.data ?? []} prs={prQ.data ?? []} />}

      {tab === "profile" && <ProfileCard />}
    </CustomerLayout>
  );
}

function SectionCard({ title, link, children }: { title: string; link?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-900">{title}</h3>
        {link && <button onClick={link.onClick} className="text-xs text-primary hover:underline">{link.label}</button>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-400 italic py-2">{text}</p>;
}

function QuoteRow({ q }: { q: QuoteSummary }) {
  return (
    <Link href={`/account/quotes/${q.id}`} className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-primary/40 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500">QUOTE-{q.id}</span>
            {statusBadge(q.status)}
          </div>
          <p className="font-semibold text-slate-900 text-sm truncate">{q.pickupAddress} → {q.dropoffAddress}</p>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {q.moveDate || "TBD"}</span>
            <span className="font-bold text-slate-900">{fmt(q.totalEstimate)}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 mt-1" />
      </div>
    </Link>
  );
}

function JobRow({ j }: { j: JobSummary }) {
  return (
    <Link href={`/account/jobs/${j.id}`} className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-primary/40 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500">{j.jobId}</span>
            {statusBadge(j.status)}
            {j.paymentStatus && statusBadge(j.paymentStatus)}
          </div>
          <p className="font-semibold text-slate-900 text-sm truncate">{j.pickupAddress} → {j.dropoffAddress}</p>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {j.moveDate || "TBD"}</span>
            {j.arrivalWindow && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {j.arrivalWindow}</span>}
            <span className="font-bold text-slate-900">{fmt(j.finalTotal)}</span>
            {(j.remainingBalance ?? 0) > 0 && (
              <span className="text-orange-600 font-semibold">Bal: {fmt(j.remainingBalance)}</span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 mt-1" />
      </div>
    </Link>
  );
}

function PaymentsTab({ payments, prs }: { payments: CustomerPayment[]; prs: PaymentRequest[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold text-slate-900 mb-3">Payment Requests</h3>
        <div className="space-y-2">
          {prs.length === 0 && <Empty text="No payment requests." />}
          {prs.map((pr) => (
            <div key={pr.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-500">PR-{pr.id}</span>
                  {statusBadge(pr.status)}
                </div>
                <p className="font-semibold text-slate-900 text-sm">{pr.description}</p>
                <p className="text-xs text-slate-500 mt-1">{pr.createdAt ? new Date(pr.createdAt).toLocaleString() : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900">{fmt(pr.amountCents / 100)}</p>
                {pr.status === "pending" && (
                  <Link href={`/account/payment-requests/${pr.id}/pay`} className="text-xs text-primary font-semibold hover:underline">
                    Pay Now →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-bold text-slate-900 mb-3">Payment History</h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400 italic">No payments yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2">Confirmation</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-right px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{p.confirmationNumber ?? `#${p.id}`}</td>
                    <td className="px-3 py-2 capitalize">{p.type.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-slate-500">{p.paidAt ? new Date(p.paidAt).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileCard() {
  const { customer } = useCustomerAuth();
  if (!customer) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg">
      <h3 className="font-bold text-slate-900 mb-4">My Profile</h3>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-slate-500 text-xs uppercase">Name</dt>
          <dd className="font-semibold text-slate-900">{customer.fullName}</dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs uppercase">Username</dt>
          <dd className="font-mono text-slate-900">{customer.username}</dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs uppercase">Email</dt>
          <dd className="text-slate-900 flex items-center gap-2">
            <span>{customer.email}</span>
            {customer.emailVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <MailWarning className="w-3 h-3" />
                Unverified
              </span>
            )}
          </dd>
        </div>
        {customer.phone && (
          <div>
            <dt className="text-slate-500 text-xs uppercase">Phone</dt>
            <dd className="text-slate-900">{customer.phone}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export default function CustomerDashboardPage() {
  return (
    <CustomerAuthGuard>
      <CustomerDashboardContent />
    </CustomerAuthGuard>
  );
}
