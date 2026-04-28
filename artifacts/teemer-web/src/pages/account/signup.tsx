import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCustomerAuth, customerApi } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerHeader } from "./layout";
import { UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";

interface FieldErrors {
  fullName?: string;
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
}

const USERNAME_REGEX = /^[A-Za-z0-9_.]{2,}$/;

function validateUsername(value: string): string | undefined {
  if (!value) return "Username is required.";
  if (!USERNAME_REGEX.test(value)) {
    return "Username may only contain letters, numbers, underscores (_), and periods (.).";
  }
  if (value.length < 2) return "Username must be at least 2 characters.";
  if (value.endsWith(".")) return "Username cannot end with a period.";
  return undefined;
}

export default function CustomerSignupPage() {
  const { setCustomer, refresh } = useCustomerAuth();
  const [, navigate] = useLocation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState("");

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!fullName.trim()) errs.fullName = "Full name is required.";
    if (!email.trim()) errs.email = "Email is required.";
    const usernameErr = validateUsername(username.trim());
    if (usernameErr) errs.username = usernameErr;
    if (!password) errs.password = "Password is required.";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (!confirmPassword) errs.confirmPassword = "Please confirm your password.";
    else if (password && confirmPassword && password !== confirmPassword)
      errs.confirmPassword = "Passwords do not match.";
    return errs;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        fullName: fullName.trim(),
        email: email.trim(),
        username: username.trim(),
        password,
        confirmPassword,
      };
      if (phone.trim()) body.phone = phone.trim();
      const res = await customerApi.fetch("/customer-auth/signup", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg: string = data.error || "Could not create account";
        if (msg.toLowerCase().includes("username")) {
          setFieldErrors({ username: msg });
        } else if (msg.toLowerCase().includes("password")) {
          setFieldErrors({ password: msg });
        } else if (msg.toLowerCase().includes("email")) {
          setFieldErrors({ email: msg });
        } else {
          setError(msg);
        }
        setSubmitting(false);
        return;
      }
      setCustomer(data.customer);
      await refresh();
      setSignedInEmail(email.trim());
      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerHeader />
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Account Created!</h1>
              <p className="text-slate-500 text-sm mt-2">
                We've sent a verification email to{" "}
                <span className="font-semibold">{signedInEmail}</span>. Check your inbox to verify
                your address.
              </p>
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

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setFieldErrors((p) => ({ ...p, fullName: undefined })); }}
                className={`mt-1 ${fieldErrors.fullName ? "border-rose-400" : ""}`}
              />
              {fieldErrors.fullName && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.fullName}</p>
              )}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
                className={`mt-1 ${fieldErrors.email ? "border-rose-400" : ""}`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.email}</p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Phone <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setFieldErrors((p) => ({ ...p, username: undefined })); }}
                placeholder="e.g. john.doe"
                className={`mt-1 font-mono ${fieldErrors.username ? "border-rose-400" : ""}`}
                autoComplete="username"
              />
              <p className="text-xs text-slate-500 mt-1">
                At least 2 characters. Letters, numbers, _ and . allowed. Cannot end with a period.
              </p>
              {fieldErrors.username && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.username}</p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined, confirmPassword: undefined })); }}
                className={`mt-1 ${fieldErrors.password ? "border-rose-400" : ""}`}
                autoComplete="new-password"
              />
              <p className="text-xs text-slate-500 mt-1">At least 8 characters.</p>
              {fieldErrors.password && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.password}</p>
              )}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                className={`mt-1 ${fieldErrors.confirmPassword ? "border-rose-400" : ""}`}
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.confirmPassword}</p>
              )}
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
