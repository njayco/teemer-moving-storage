import { InfoLayout } from "@/components/layout/info-layout";
import { CheckCircle2, Calendar, Phone, ArrowRight } from "lucide-react";
import { useSearch } from "wouter";
import { useGetQuoteRequest } from "@workspace/api-client-react";
import { Link } from "wouter";

export default function QuoteConfirmationPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const quoteId = params.get("quoteId") ?? "";

  const { data: quote } = useGetQuoteRequest(quoteId, {
    query: { enabled: !!quoteId, queryKey: ["quote", quoteId] },
  });

  const moveDate = quote?.quoteRequest?.moveDate;
  const customerName = quote?.quoteRequest?.contactName;
  const totalEstimate = quote?.totalEstimate;
  const depositAmount = quote?.depositAmount;
  const crewSize = quote?.crewSize;
  const estimatedHours = quote?.estimatedHours;

  return (
    <InfoLayout>
      <div className="min-h-[70vh] bg-gradient-to-br from-green-50 to-slate-50 py-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-primary px-8 py-10 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">You're All Set!</h1>
              <p className="text-green-100 text-sm">Your deposit was received and your move is reserved.</p>
            </div>

            <div className="px-8 py-8 space-y-6">
              {customerName && (
                <p className="text-slate-700 text-sm">
                  Hi <strong>{customerName}</strong>, thank you for choosing Teemer Moving & Storage. Our team will reach out to confirm your move details.
                </p>
              )}

              {quote && (
                <div className="bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                  {moveDate && (
                    <div className="flex items-center gap-3 px-5 py-4">
                      <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Move Date</p>
                        <p className="font-semibold text-slate-800 text-sm">
                          {new Date(moveDate + "T12:00:00").toLocaleDateString("en-US", {
                            weekday: "long", year: "numeric", month: "long", day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                  {crewSize && estimatedHours && (
                    <div className="px-5 py-4">
                      <p className="text-xs text-slate-400 font-medium mb-1">Crew</p>
                      <p className="font-semibold text-slate-800 text-sm">
                        {crewSize} movers · ~{estimatedHours} hrs
                      </p>
                    </div>
                  )}
                  {depositAmount != null && (
                    <div className="px-5 py-4">
                      <p className="text-xs text-slate-400 font-medium mb-1">Deposit Paid</p>
                      <p className="font-bold text-primary text-lg">
                        ${depositAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {totalEstimate != null && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Remaining balance due on move day: ${(totalEstimate - depositAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  )}
                  {quoteId && (
                    <div className="px-5 py-4">
                      <p className="text-xs text-slate-400">Quote ID: #{quoteId}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-green-50 rounded-xl border border-green-100 p-4 space-y-2">
                {[
                  "Our team will call to confirm the time window",
                  "Remaining balance is due on move day",
                  "10% discount for Seniors & Veterans — remind us when we call",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-green-800">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">Have a question?</p>
                <a
                  href="tel:+15162693724"
                  className="flex items-center gap-3 border-2 border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-semibold hover:border-primary hover:text-primary transition-all text-sm justify-center"
                >
                  <Phone className="w-4 h-4" />
                  (516) 269-3724
                </a>
              </div>

              <Link
                href="/info"
                className="flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors pt-2"
              >
                Back to Home <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
