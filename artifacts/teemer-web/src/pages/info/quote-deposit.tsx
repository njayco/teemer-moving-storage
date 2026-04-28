import { InfoLayout } from "@/components/layout/info-layout";
import { useRoute } from "wouter";
import { CreditCard, Phone, CheckCircle2, Lock, ArrowLeft, Loader2, AlertCircle, Calendar, Users, FileText, Tag } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useGetQuoteRequest } from "@workspace/api-client-react";

export default function QuoteDepositPage() {
  const [, params] = useRoute("/info/quote/deposit/:quoteId");
  const quoteId = params?.quoteId ?? "";

  const { data: quote } = useGetQuoteRequest(quoteId, {
    query: { enabled: !!quoteId, queryKey: ["deposit-quote", quoteId] },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [discountStatus, setDiscountStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const baseDeposit = quote?.depositAmount ?? 0;
  const codeUpper = discountCode.trim().toUpperCase();
  const isSandvCode = codeUpper === "SANDV10";
  const discountedDeposit = isSandvCode ? Math.round(baseDeposit * 90) / 100 : baseDeposit;

  const handlePayDeposit = async () => {
    setLoading(true);
    setError(null);
    setDiscountStatus(null);
    try {
      const trimmed = discountCode.trim();
      const res = await fetch(`/api/quotes/${quoteId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trimmed ? { discountCode: trimmed } : {}),
      });
      const data = await res.json() as { url?: string; error?: string; discountApplied?: boolean };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Unable to start checkout. Please call us to pay the deposit.");
        return;
      }
      if (trimmed && data.discountApplied === false) {
        setDiscountStatus({ ok: false, msg: "That code wasn't valid — proceeding without a discount." });
      }
      window.location.href = data.url;
    } catch {
      setError("Unable to connect to payment service. Please call us to pay the deposit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <InfoLayout>
      <div className="min-h-[60vh] bg-gradient-to-br from-slate-50 to-green-50/30 py-16 px-4">
        <div className="max-w-lg mx-auto">
          <Link href="/info/quote" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Quote
          </Link>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-primary/5 border-b border-primary/10 px-8 py-6 text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Reserve Your Move</h1>
              {quoteId && (
                <p className="text-xs text-slate-400 mt-1">Quote #{quoteId}</p>
              )}
            </div>

            <div className="px-8 py-8 space-y-6">
              {quote && (
                <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                  {quote.depositAmount != null && (
                    <div className="px-5 py-4 text-center">
                      <p className="text-xs text-slate-400 font-medium mb-1">Deposit Amount</p>
                      {isSandvCode ? (
                        <div>
                          <p className="text-sm text-slate-400 line-through">
                            ${baseDeposit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-2xl font-bold text-primary">
                            ${discountedDeposit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-green-700 font-semibold mt-0.5">SANDV10 — 10% off</p>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-primary">
                          ${baseDeposit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex divide-x divide-slate-100">
                    {quote.quoteRequest?.moveDate && (
                      <div className="flex-1 px-4 py-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-[10px] text-slate-400">Move Date</p>
                          <p className="text-xs font-semibold text-slate-700">
                            {new Date(quote.quoteRequest.moveDate + "T12:00:00").toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                    {quote.crewSize && (
                      <div className="flex-1 px-4 py-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-[10px] text-slate-400">Crew</p>
                          <p className="text-xs font-semibold text-slate-700">
                            {quote.crewSize} movers · ~{quote.estimatedHours} hrs
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {quote.totalEstimate != null && (
                    <div className="px-5 py-3 text-center">
                      <p className="text-xs text-slate-400">
                        Total estimate: ${quote.totalEstimate.toLocaleString("en-US", { minimumFractionDigits: 2 })} · Balance due on move day
                      </p>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">Payment Unavailable</p>
                    <p className="text-sm text-amber-800 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30 cursor-pointer accent-[#2F7B2F]"
                  />
                  <span className="text-sm text-slate-600 leading-relaxed">
                    I have read and agree to the{" "}
                    <Link
                      href="/info/terms"
                      className="text-primary font-semibold underline underline-offset-2 hover:text-primary/80"
                      target="_blank"
                    >
                      Privacy Policy &amp; Terms of Service
                    </Link>
                    , including the deposit, cancellation, and additional charges policies.
                  </span>
                </label>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none mt-0.5">🎖️</span>
                  <div>
                    <p className="font-semibold text-green-900 text-sm">Senior & Veteran Discount</p>
                    <p className="text-sm text-green-800 mt-1">
                      Qualifying seniors and veterans: enter code{" "}
                      <span className="font-bold tracking-wider bg-green-100 px-1.5 py-0.5 rounded border border-green-300">SANDV10</span>
                      {" "}below for 10% off your deposit.
                    </p>
                  </div>
                </div>
                <div className="flex items-stretch gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={discountCode}
                      onChange={(e) => { setDiscountCode(e.target.value); setDiscountStatus(null); }}
                      placeholder="Enter discount code (optional)"
                      maxLength={32}
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white border border-green-300 text-slate-800 text-sm font-medium uppercase tracking-wide placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30 outline-none"
                    />
                  </div>
                  {isSandvCode && (
                    <span className="inline-flex items-center px-3 py-2.5 rounded-lg bg-primary text-white text-xs font-bold">
                      Applied ✓
                    </span>
                  )}
                </div>
                {discountCode.trim() && !isSandvCode && (
                  <p className="text-xs text-amber-700">
                    Code will be validated at checkout. Only valid codes apply a discount.
                  </p>
                )}
                {discountStatus && !discountStatus.ok && (
                  <p className="text-xs text-amber-700">{discountStatus.msg}</p>
                )}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handlePayDeposit}
                  disabled={loading || !quoteId || !termsAccepted}
                  className="w-full flex items-center gap-3 bg-primary text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to Payment…</>
                  ) : (
                    <><CreditCard className="w-5 h-5" /> Pay Deposit Online</>
                  )}
                </button>
                {!termsAccepted && (
                  <p className="text-center text-xs text-amber-600 font-medium">
                    Please agree to the terms and conditions to proceed
                  </p>
                )}
                <p className="text-center text-xs text-slate-400">
                  Secured by Stripe · Your card details are never stored on our servers
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400 font-medium">or reserve by phone</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <a
                href="tel:+15162693724"
                className="flex items-center gap-3 border-2 border-slate-200 text-slate-700 px-6 py-4 rounded-xl font-semibold hover:border-primary hover:text-primary transition-all justify-center"
              >
                <Phone className="w-5 h-5" />
                (516) 269-3724
              </a>
              <p className="text-center text-xs text-slate-400">
                Mon–Fri 7AM–6PM · Long Beach, NY 11561
              </p>

              <div className="border-t border-slate-100 pt-6 space-y-2">
                {[
                  "We'll confirm your move date and crew",
                  "Deposit secures your spot on our schedule",
                  "No hidden fees — price matches your quote",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
