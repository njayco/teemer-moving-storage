import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useCustomerAuth, customerApi } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import { CustomerHeader } from "./layout";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type VerifyState =
  | { status: "loading" }
  | { status: "success"; alreadyVerified: boolean }
  | { status: "error"; error: string };

export default function CustomerVerifyEmailPage() {
  const { customer, refresh } = useCustomerAuth();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [state, setState] = useState<VerifyState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!token) {
        setState({ status: "error", error: "Missing verification token in this link." });
        return;
      }
      try {
        const res = await customerApi.fetch("/customer-auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.success) {
          setState({ status: "success", alreadyVerified: !!data.alreadyVerified });
          // Refresh /me so the dashboard hides the "verify your email" banner.
          refresh().catch(() => {});
        } else {
          setState({ status: "error", error: data?.error || "Could not verify your email." });
        }
      } catch {
        if (!cancelled) setState({ status: "error", error: "Network error while verifying your email." });
      }
    };
    verify();
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerHeader />
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          {state.status === "loading" && (
            <>
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-slate-400" />
              <p className="text-slate-500 text-sm mt-3">Verifying your email…</p>
            </>
          )}

          {state.status === "success" && (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {state.alreadyVerified ? "Already verified" : "Email verified!"}
              </h1>
              <p className="text-slate-600 text-sm mt-2">
                {state.alreadyVerified
                  ? "Your email was already confirmed — you're all set."
                  : "Thanks for confirming your email. Your account is fully set up."}
              </p>
              <div className="mt-6 space-y-2">
                {customer ? (
                  <Button onClick={() => navigate("/account")} className="w-full">
                    Continue to my dashboard
                  </Button>
                ) : (
                  <Link href="/account/login">
                    <Button className="w-full">Sign in</Button>
                  </Link>
                )}
              </div>
            </>
          )}

          {state.status === "error" && (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-rose-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Verification failed</h1>
              <p className="text-slate-600 text-sm mt-2">{state.error}</p>
              <p className="text-xs text-slate-500 mt-3">
                Verification links expire after 24 hours. Sign in and request a new one from your dashboard.
              </p>
              <div className="mt-6 space-y-2">
                <Link href="/account/login">
                  <Button className="w-full">Sign in</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
