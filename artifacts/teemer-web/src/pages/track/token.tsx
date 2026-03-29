import { InfoLayout } from "@/components/layout/info-layout";
import { StatusTimeline } from "@/components/StatusTimeline";
import { useGetTrackingByToken } from "@workspace/api-client-react";
import { useRoute, Link } from "wouter";
import { Loader2, AlertCircle, Package, MapPin, Calendar, DollarSign } from "lucide-react";

export default function TrackByTokenPage() {
  const [, params] = useRoute("/track/:token");
  const token = params?.token ?? "";

  const { data, isLoading, isError } = useGetTrackingByToken(token, {
    query: { enabled: !!token },
  });

  return (
    <InfoLayout>
      <section className="py-16 bg-gradient-to-b from-slate-50 to-white min-h-[60vh]">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-display text-secondary mb-3">
              Track Your Move
            </h1>
          </div>

          {isLoading && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-slate-500">Loading your move details...</p>
            </div>
          )}

          {isError && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-secondary mb-2">Tracking Link Not Found</h2>
              <p className="text-slate-600 mb-6">
                This tracking link may have expired or is invalid.
              </p>
              <Link
                href="/track"
                className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Look Up Your Move Instead
              </Link>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-secondary">Move Details</h2>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      data.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : data.status === "in_transit"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {data.status?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Pending"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoItem icon={Package} label="Customer" value={data.customerName} />
                  <InfoItem icon={Calendar} label="Move Date" value={data.moveDate || "TBD"} />
                  <InfoItem icon={MapPin} label="From" value={data.pickupAddress} />
                  <InfoItem icon={MapPin} label="To" value={data.dropoffAddress} />
                </div>

                {(data.totalEstimate > 0 || data.depositPaid > 0) && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-sm text-slate-500">Estimated Total</p>
                        <p className="text-lg font-bold text-secondary">
                          ${data.totalEstimate?.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-500">Deposit Paid</p>
                        <p className="text-lg font-bold text-green-600">
                          ${data.depositPaid?.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-slate-500">Balance Due</p>
                        <p className="text-lg font-bold text-slate-700">
                          ${data.remainingBalance?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
                <h2 className="text-xl font-bold text-secondary mb-6">Status Timeline</h2>
                <StatusTimeline events={data.timeline || []} />
              </div>
            </div>
          )}
        </div>
      </section>
    </InfoLayout>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}
