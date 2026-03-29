import { CheckCircle2, Circle, Clock, Truck, CreditCard, UserCheck, Package, MapPin } from "lucide-react";

interface TimelineEvent {
  id: number;
  eventType: string;
  statusLabel?: string | null;
  createdAt?: string | null;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  deposit_paid: { icon: CreditCard, color: "text-green-600", label: "Deposit Paid" },
  status_change: { icon: Clock, color: "text-blue-600", label: "Status Updated" },
  captain_assigned: { icon: UserCheck, color: "text-purple-600", label: "Captain Assigned" },
  job_created: { icon: Package, color: "text-indigo-600", label: "Job Created" },
  crew_dispatched: { icon: Truck, color: "text-orange-600", label: "Crew Dispatched" },
  in_transit: { icon: Truck, color: "text-orange-600", label: "In Transit" },
  arrived: { icon: MapPin, color: "text-teal-600", label: "Arrived" },
  completed: { icon: CheckCircle2, color: "text-green-700", label: "Move Completed" },
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StatusTimeline({ events }: { events: TimelineEvent[] }) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Clock className="w-8 h-8 mx-auto mb-3 text-slate-300" />
        <p>No status updates yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-slate-200" />
      <div className="space-y-6">
        {sorted.map((event, idx) => {
          const config = EVENT_CONFIG[event.eventType] || {
            icon: Circle,
            color: "text-slate-500",
            label: "Update",
          };
          const Icon = config.icon;
          const isLast = idx === sorted.length - 1;

          return (
            <div key={event.id} className="relative flex items-start gap-4">
              <div
                className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full ${
                  isLast ? "bg-primary/10 ring-2 ring-primary/30" : "bg-white border-2 border-slate-200"
                }`}
              >
                <Icon className={`w-5 h-5 ${isLast ? "text-primary" : config.color}`} />
              </div>
              <div className="flex-1 pt-1">
                <p className={`font-semibold ${isLast ? "text-slate-900" : "text-slate-700"}`}>
                  {event.statusLabel || config.label}
                </p>
                {event.createdAt && (
                  <p className="text-sm text-slate-500 mt-0.5">{formatDate(event.createdAt)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
