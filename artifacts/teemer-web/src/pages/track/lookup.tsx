import { InfoLayout } from "@/components/layout/info-layout";
import { StatusTimeline } from "@/components/StatusTimeline";
import { useLookupTracking } from "@workspace/api-client-react";
import type { TrackingResponse } from "@workspace/api-client-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Search, Loader2, AlertCircle, Package, MapPin, Calendar, DollarSign, Phone } from "lucide-react";

const lookupSchema = z.object({
  jobId: z.string().min(1, "Job ID or Quote # is required"),
  email: z.string().email("A valid email is required"),
});

type LookupForm = z.infer<typeof lookupSchema>;

export default function TrackLookupPage() {
  const [trackingData, setTrackingData] = useState<TrackingResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mutation = useLookupTracking();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LookupForm>({
    resolver: zodResolver(lookupSchema),
  });

  const onSubmit = (data: LookupForm) => {
    setErrorMsg(null);
    setTrackingData(null);
    mutation.mutate(
      { data },
      {
        onSuccess: (result) => {
          setTrackingData(result);
        },
        onError: () => {
          setErrorMsg("No matching move found. Please check your Job ID and email address.");
        },
      }
    );
  };

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
            <p className="text-slate-600">
              Enter your Job ID (or Quote #) and the email address you used when booking.
            </p>
          </div>

          {!trackingData && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 space-y-6"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Job ID / Quote Number
                </label>
                <input
                  {...register("jobId")}
                  placeholder="e.g. Job820 or 42"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                />
                {errors.jobId && (
                  <p className="text-red-500 text-sm mt-1">{errors.jobId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address
                </label>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>

              {errorMsg && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full bg-primary text-white py-3.5 rounded-xl font-bold shadow-lg shadow-primary/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Look Up My Move
                  </>
                )}
              </button>
            </form>
          )}

          {trackingData && <TrackingResult data={trackingData} onReset={() => setTrackingData(null)} />}
        </div>
      </section>
    </InfoLayout>
  );
}

function TrackingResult({ data, onReset }: { data: TrackingResponse; onReset: () => void }) {
  return (
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
            {data.status?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Pending"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoItem icon={Package} label="Customer" value={data.customerName} />
          <InfoItem icon={Calendar} label="Move Date" value={data.moveDate || "TBD"} />
          <InfoItem icon={MapPin} label="From" value={data.pickupAddress} />
          <InfoItem icon={MapPin} label="To" value={data.dropoffAddress} />
          {data.arrivalWindow && (
            <InfoItem icon={Calendar} label="Arrival Window" value={data.arrivalWindow} />
          )}
          {data.jobId && (
            <InfoItem icon={Package} label="Job ID" value={data.jobId} />
          )}
        </div>

        {(data.totalEstimate > 0 || data.depositPaid > 0) && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-slate-500">Estimated Total</p>
                <p className="text-lg font-bold text-secondary">${data.totalEstimate?.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Deposit Paid</p>
                <p className="text-lg font-bold text-green-600">${data.depositPaid?.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Balance Due</p>
                <p className="text-lg font-bold text-slate-700">${data.remainingBalance?.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span className={`text-sm font-medium px-2 py-1 rounded ${
                data.paymentStatus === "paid" ? "bg-green-100 text-green-700" :
                data.paymentStatus === "deposit_paid" ? "bg-blue-100 text-blue-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                Payment: {data.paymentStatus?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Pending"}
              </span>
              {data.invoiceStatus && data.invoiceStatus !== "none" && (
                <span className="ml-2 text-sm font-medium px-2 py-1 rounded bg-slate-100 text-slate-600">
                  Invoice: {data.invoiceStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
        <h2 className="text-xl font-bold text-secondary mb-6">Status Timeline</h2>
        <StatusTimeline events={data.timeline || []} />
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-center">
        <h3 className="font-bold text-secondary mb-2">Questions about your move?</h3>
        <p className="text-slate-600 text-sm mb-3">Our team is here to help.</p>
        <a
          href="tel:5162693724"
          className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold hover:-translate-y-0.5 transition-all"
        >
          <Phone className="w-4 h-4" />
          Call (516) 269-3724
        </a>
      </div>

      <button
        onClick={onReset}
        className="text-primary font-semibold hover:underline text-sm"
      >
        &larr; Look up another move
      </button>
    </div>
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
