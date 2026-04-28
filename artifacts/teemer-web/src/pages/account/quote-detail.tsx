import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CustomerLayout, CustomerAuthGuard } from "./layout";
import { customerApi } from "@/lib/customer-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Calendar, MapPin, DollarSign, Save } from "lucide-react";

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);

function QuoteDetailContent() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const id = params.id;

  const quoteQ = useQuery({
    queryKey: ["customer-quote", id],
    queryFn: () => customerApi.json<Record<string, unknown>>(`/customer/quotes/${id}`),
  });

  type FormState = {
    moveDate?: string;
    arrivalTimeWindow?: string;
    pickupAddress?: string;
    dropoffAddress?: string;
    secondStop?: string;
    additionalNotes?: string;
    parkingInstructions?: string;
    phone?: string;
  };
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<FormState>({});

  useEffect(() => {
    if (quoteQ.data) {
      const d = quoteQ.data as Record<string, string | undefined>;
      setForm({
        moveDate: d.moveDate ?? "",
        arrivalTimeWindow: d.arrivalTimeWindow ?? "",
        pickupAddress: d.pickupAddress ?? "",
        dropoffAddress: d.dropoffAddress ?? "",
        secondStop: d.secondStop ?? "",
        additionalNotes: d.additionalNotes ?? "",
        parkingInstructions: d.parkingInstructions ?? "",
        phone: d.phone ?? "",
      });
    }
  }, [quoteQ.data]);

  const save = useMutation({
    mutationFn: (body: FormState) =>
      customerApi.json(`/customer/quotes/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-quote", id] });
      qc.invalidateQueries({ queryKey: ["customer-quotes"] });
      setEdit(false);
    },
  });

  if (quoteQ.isLoading) {
    return (
      <CustomerLayout><p className="text-slate-500">Loading…</p></CustomerLayout>
    );
  }
  if (quoteQ.error || !quoteQ.data) {
    return (
      <CustomerLayout>
        <p className="text-rose-600">Couldn't load this quote.</p>
        <Link href="/account" className="text-primary text-sm">← Back to dashboard</Link>
      </CustomerLayout>
    );
  }

  const q = quoteQ.data as Record<string, unknown>;
  const status = String(q.status ?? "quote_requested");
  const isEditable = status === "quote_requested";

  return (
    <CustomerLayout>
      <Link href="/account" className="inline-flex items-center text-sm text-slate-500 hover:text-primary mb-3">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-mono text-slate-500">QUOTE-{id}</p>
          <h1 className="text-2xl font-bold text-slate-900">Saved Quote</h1>
          <p className="text-xs text-slate-500 capitalize">{status.replace(/_/g, " ")}</p>
        </div>
        <div className="flex gap-2">
          {isEditable && !edit && (
            <Button variant="outline" onClick={() => setEdit(true)}>Edit</Button>
          )}
          {isEditable && (
            <Button
              onClick={() => navigate(`/info/quote/deposit/${id}`)}
              className="bg-primary text-white"
            >
              Reserve with Deposit
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <SummaryCard
          icon={<Calendar className="w-4 h-4 text-primary" />}
          label="Move Date"
          value={String(q.moveDate ?? "—")}
          extra={q.arrivalTimeWindow ? String(q.arrivalTimeWindow) : null}
        />
        <SummaryCard
          icon={<DollarSign className="w-4 h-4 text-primary" />}
          label="Total Estimate"
          value={fmt(Number(q.totalEstimate ?? 0))}
          extra={q.depositAmount ? `Deposit: ${fmt(Number(q.depositAmount))}` : null}
        />
        <SummaryCard
          icon={<MapPin className="w-4 h-4 text-emerald-600" />}
          label="Pickup"
          value={String(q.pickupAddress ?? q.originAddress ?? "—")}
        />
        <SummaryCard
          icon={<MapPin className="w-4 h-4 text-rose-600" />}
          label="Dropoff"
          value={String(q.dropoffAddress ?? q.destinationAddress ?? "—")}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {edit ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Move Date</Label>
                <Input value={form.moveDate ?? ""} onChange={(e) => setForm({ ...form, moveDate: e.target.value })} />
              </div>
              <div>
                <Label>Arrival Window</Label>
                <Input value={form.arrivalTimeWindow ?? ""} onChange={(e) => setForm({ ...form, arrivalTimeWindow: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Second Stop (optional)</Label>
                <Input value={form.secondStop ?? ""} onChange={(e) => setForm({ ...form, secondStop: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Pickup Address</Label>
                <Input value={form.pickupAddress ?? ""} onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Dropoff Address</Label>
                <Input value={form.dropoffAddress ?? ""} onChange={(e) => setForm({ ...form, dropoffAddress: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Parking Instructions</Label>
                <Textarea value={form.parkingInstructions ?? ""} onChange={(e) => setForm({ ...form, parkingInstructions: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Additional Notes</Label>
                <Textarea value={form.additionalNotes ?? ""} onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })} />
              </div>
            </div>
            {save.error && <p className="text-rose-600 text-sm">{(save.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending}>
                <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Saving…" : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEdit(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {(q.crewSize as number) && <Row label="Crew Size" value={`${q.crewSize} movers`} />}
            {(q.estimatedHours as number) && <Row label="Estimated Hours" value={`${q.estimatedHours} hrs`} />}
            {(q.hourlyRate as number) && <Row label="Hourly Rate" value={fmt(Number(q.hourlyRate))} />}
            {(q.parkingInstructions as string) && <Row label="Parking" value={String(q.parkingInstructions)} />}
            {(q.additionalNotes as string) && <Row label="Notes" value={String(q.additionalNotes)} />}
            {(q.secondStop as string) && <Row label="Second Stop" value={String(q.secondStop)} />}
          </dl>
        )}
      </div>
    </CustomerLayout>
  );
}

function SummaryCard({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: string; extra?: string | null }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-slate-500 font-semibold tracking-wide">
        {icon} {label}
      </div>
      <p className="text-slate-900 font-semibold mt-1 break-words">{value}</p>
      {extra && <p className="text-xs text-slate-500 mt-0.5">{extra}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500 font-semibold tracking-wide">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}

export default function CustomerQuoteDetailPage() {
  return (
    <CustomerAuthGuard>
      <QuoteDetailContent />
    </CustomerAuthGuard>
  );
}
