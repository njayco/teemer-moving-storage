import { InfoLayout } from "@/components/layout/info-layout";
import { useRoute } from "wouter";
import { CreditCard, Phone, CheckCircle2, Lock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function QuoteDepositPage() {
  const [, params] = useRoute("/info/quote/deposit/:quoteId");
  const quoteId = params?.quoteId ?? "";

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
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 text-sm">Online Deposit Coming Soon</p>
                  <p className="text-sm text-amber-800 mt-1">
                    We're setting up secure online payments. In the meantime, call or text us to reserve your date with a deposit over the phone.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-semibold text-slate-800">Reserve by phone or text:</p>
                <a
                  href="tel:+15162693724"
                  className="flex items-center gap-3 bg-primary text-white px-6 py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 justify-center"
                >
                  <Phone className="w-5 h-5" />
                  (516) 269-3724
                </a>
                <p className="text-center text-xs text-slate-400">
                  Mon–Fri 7AM–6PM · Long Beach, NY 11561
                </p>
              </div>

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
