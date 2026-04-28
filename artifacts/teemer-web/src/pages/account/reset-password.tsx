import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useCustomerAuth, customerApi } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerHeader } from "./layout";
import { KeyRound, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type CheckState =
  | { status: "loading" }
  | { status: "valid"; email: string | null }
  | { status: "invalid"; error: string };

export default function CustomerResetPasswordPage() {
  const { setCustomer, refresh } = useCustomerAuth();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [check, setCheck] = useState<CheckState>({ status: "loading" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      if (!token) {
        setCheck({ status: "invalid", error: "Missing reset token in this link." });
        return;
      }
      try {
        const res = await customerApi.fetch(
          `/customer-auth/reset-password/check?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.valid) {
          setCheck({ status: "valid", email: data.email ?? null });
        } else {
          setCheck({ status: "invalid", error: data?.error || "This reset link is invalid or has expired." });
        }
      } catch {
        if (!cancelled) setCheck({ status: "invalid", error: "Could not verify the reset link. Please try again." });
      }
    };
    validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await customerApi.fetch("/customer-auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not reset password.");
        setSubmitting(false);
        return;
      }
      if (data?.customer) {
        setCustomer(data.customer);
        await refresh();
      }
      setDone(true);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Password Reset!</h1>
            <p className="text-slate-600 text-sm mt-2">
              Your new password is now active and you're signed in.
            </p>
            <Button onClick={() => navigate("/account")} className="w-full mt-6">
              Continue to my dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (check.status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-slate-400" />
            <p className="text-slate-500 text-sm mt-3">Checking your reset link…</p>
          </div>
        </div>
      </div>
    );
  }

  if (check.status === "invalid") {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Link not valid</h1>
            <p className="text-slate-600 text-sm mt-2">{check.error}</p>
            <div className="mt-6 space-y-2">
              <Link href="/account/forgot-password">
                <Button className="w-full">Request a new link</Button>
              </Link>
              <Link href="/account/login">
                <Button variant="outline" className="w-full">Back to sign in</Button>
              </Link>
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
            <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
            {check.email && (
              <p className="text-slate-500 text-sm mt-1">
                For <span className="font-semibold">{check.email}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">At least 8 characters.</p>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Updating…" : "Update Password"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
