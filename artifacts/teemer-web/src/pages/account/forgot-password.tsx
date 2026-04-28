import { useState } from "react";
import { Link } from "wouter";
import { customerApi, useCustomerAuth } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerHeader } from "./layout";
import { KeyRound, AlertCircle, MailCheck, MailWarning } from "lucide-react";

export default function CustomerForgotPasswordPage() {
  const { customer } = useCustomerAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const resendVerification = async () => {
    setResendState("sending");
    try {
      const res = await customerApi.fetch("/customer-auth/resend-verification", { method: "POST" });
      setResendState(res.ok ? "sent" : "error");
    } catch {
      setResendState("error");
    }
  };

  // Signed-in but unverified customers can't usefully request a reset — the
  // backend will only send a verification email in that case. Surface that
  // upfront so they don't think the form is broken.
  if (customer && customer.emailVerified === false) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-3">
              <MailWarning className="w-6 h-6 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Verify your email first</h1>
            <p className="text-slate-600 text-sm mt-2">
              For your security, we can only send password reset links to verified
              email addresses. Please confirm <span className="font-semibold">{customer.email}</span> first.
            </p>
            {resendState === "sent" ? (
              <p className="text-sm text-emerald-700 mt-4">
                Verification email sent — check your inbox.
              </p>
            ) : (
              <Button
                onClick={resendVerification}
                disabled={resendState === "sending"}
                className="w-full mt-6"
              >
                {resendState === "sending" ? "Sending…" : "Send verification email"}
              </Button>
            )}
            {resendState === "error" && (
              <p className="text-xs text-rose-700 mt-2">
                Couldn't send the email. Please try again.
              </p>
            )}
            <div className="mt-4">
              <Link href="/account/dashboard">
                <Button variant="outline" className="w-full">Back to dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await customerApi.fetch("/customer-auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <MailCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
            <p className="text-slate-600 text-sm mt-2">
              If a verified account exists for <span className="font-semibold">{email}</span>,
              we've sent a password reset link that expires in 1 hour.
            </p>
            <p className="text-xs text-slate-500 mt-4">
              Haven't confirmed your email yet? We'll send a verification link
              instead — confirm your address, then come back to reset your password.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Didn't get anything? Check your spam folder, or try again in a minute.
            </p>
            <div className="mt-6 space-y-2">
              <Link href="/account/login">
                <Button variant="outline" className="w-full">Back to sign in</Button>
              </Link>
              <button
                type="button"
                className="w-full text-sm text-slate-500 hover:text-primary hover:underline"
                onClick={() => setSent(false)}
              >
                Use a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerHeader />
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Forgot Password</h1>
            <p className="text-slate-500 text-sm mt-1">
              Enter the email on your account and we'll send a reset link.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Sending…" : "Send Reset Link"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Remember your password?{" "}
            <Link href="/account/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
