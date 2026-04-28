import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCustomerAuth, customerApi } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerHeader } from "./layout";
import { UserPlus, AlertCircle, CheckCircle2, Copy } from "lucide-react";

export default function CustomerSignupPage() {
  const { setCustomer, refresh } = useCustomerAuth();
  const [, navigate] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [generatedUsername, setGeneratedUsername] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        fullName: fullName.trim(),
        email: email.trim(),
      };
      if (phone.trim()) body.phone = phone.trim();
      if (username.trim()) body.username = username.trim();
      const res = await customerApi.fetch("/customer-auth/signup", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create account");
        setSubmitting(false);
        return;
      }
      setCustomer(data.customer);
      await refresh();
      setGeneratedUsername(data.customer?.username ?? username ?? null);
      if (data.generatedPassword) {
        setGeneratedPassword(data.generatedPassword);
      } else {
        navigate("/account");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (generatedPassword) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Account Created!</h1>
              <p className="text-slate-500 text-sm mt-1">
                We've emailed your login details to <span className="font-semibold">{email}</span>.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 my-4 space-y-2">
              <div>
                <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide">Username</p>
                <p className="font-mono text-slate-900 text-sm break-all">{generatedUsername || "(generated)"}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-slate-500 tracking-wide">Temporary Password</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm font-mono break-all">
                    {generatedPassword}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigator.clipboard.writeText(generatedPassword).catch(() => {})}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-amber-700 mt-2">
                  Please save this password — for security we won't show it again.
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/account")} className="w-full">
              Continue to my dashboard
            </Button>
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
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Create Your Account</h1>
            <p className="text-slate-500 text-sm mt-1">Save quotes, track jobs, and pay balances online</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="username">Username (optional)</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="+yourname"
                className="mt-1 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Starts with + and 3-30 letters/digits/underscores. Leave blank to auto-generate.</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 text-sm text-slate-600">
              <p className="font-medium text-slate-700">A strong password will be generated for you.</p>
              <p className="text-xs mt-1">We'll email it to you and show it once on the next screen — keep it safe.</p>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Creating account…" : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/account/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
