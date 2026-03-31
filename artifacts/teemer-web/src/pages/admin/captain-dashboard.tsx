import { useState, useCallback } from "react";
import {
  useListCaptainJobs,
  useUpdateCaptainJobStatus,
  useAddCaptainNote,
  type CaptainJob,
  type CaptainStatusUpdateRequestStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  Truck,
  Clock,
  CheckCircle,
  MapPin,
  Calendar,
  Users,
  ChevronRight,
  LogOut,
  MessageSquare,
  AlertTriangle,
  Navigation,
  Package,
  Warehouse,
  RotateCcw,
  Timer,
  Send,
  Loader2,
  DollarSign,
  X,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Truck; color: string; bg: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  scheduled: { label: "Scheduled", icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
  captain_assigned: { label: "Assigned", icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
  en_route: { label: "En Route", icon: Navigation, color: "text-sky-600", bg: "bg-sky-50" },
  arrived: { label: "Arrived", icon: MapPin, color: "text-teal-600", bg: "bg-teal-50" },
  in_progress: { label: "In Progress", icon: Truck, color: "text-orange-600", bg: "bg-orange-50" },
  at_storage: { label: "At Storage", icon: Warehouse, color: "text-indigo-600", bg: "bg-indigo-50" },
  returning: { label: "Returning", icon: RotateCcw, color: "text-cyan-600", bg: "bg-cyan-50" },
  delayed: { label: "Delayed", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  finished: { label: "Finished", icon: DollarSign, color: "text-yellow-600", bg: "bg-yellow-50" },
  complete: { label: "Completed", icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
  awaiting_remaining_balance: { label: "Awaiting Balance", icon: Timer, color: "text-yellow-600", bg: "bg-yellow-50" },
  paid_in_cash: { label: "Paid Cash", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
  cancelled: { label: "Cancelled", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
};

const CAPTAIN_ACTIONS = [
  { status: "scheduled", label: "Scheduled", icon: Clock, color: "bg-blue-500 hover:bg-blue-600" },
  { status: "en_route", label: "En Route", icon: Navigation, color: "bg-sky-500 hover:bg-sky-600" },
  { status: "arrived", label: "Arrived", icon: MapPin, color: "bg-teal-500 hover:bg-teal-600" },
  { status: "in_progress", label: "Start Job", icon: Truck, color: "bg-orange-500 hover:bg-orange-600" },
  { status: "at_storage", label: "At Storage", icon: Warehouse, color: "bg-indigo-500 hover:bg-indigo-600" },
  { status: "returning", label: "Returning", icon: RotateCcw, color: "bg-cyan-500 hover:bg-cyan-600" },
  { status: "finished", label: "Finish Job", icon: DollarSign, color: "bg-yellow-500 hover:bg-yellow-600" },
  { status: "delayed", label: "Delayed", icon: AlertTriangle, color: "bg-red-500 hover:bg-red-600" },
];

function getNextActions(currentStatus: string) {
  const flowMap: Record<string, string[]> = {
    pending: ["en_route"],
    scheduled: ["en_route"],
    captain_assigned: ["en_route"],
    en_route: ["arrived", "delayed"],
    arrived: ["in_progress", "delayed"],
    in_progress: ["at_storage", "finished", "delayed"],
    at_storage: ["returning", "finished", "delayed"],
    returning: ["finished", "delayed"],
    delayed: ["scheduled", "en_route", "arrived", "in_progress"],
  };
  return flowMap[currentStatus] || [];
}

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function isFuture(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
  return d > today;
}

function FinishJobModal({
  job,
  onClose,
  onConfirm,
}: {
  job: CaptainJob;
  onClose: () => void;
  onConfirm: (actualHours: number, notes: string) => void;
}) {
  const estimatedHours = job.estimatedHours ?? job.quoteData?.estimatedHours ?? 0;
  const [actualHours, setActualHours] = useState(estimatedHours);
  const [finishNotes, setFinishNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-5 pt-5 pb-2 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-secondary text-base">Finish Job</h3>
            <p className="text-xs text-slate-500 mt-0.5">Confirm actual hours worked</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
            This will mark the job as finished and calculate the final invoice based on actual hours. Admin will then send the balance invoice to the customer.
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">
              Actual Hours Worked <span className="text-slate-400 font-normal">(estimated: {estimatedHours}h)</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActualHours(h => Math.max(0.5, h - 0.5))}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center transition-colors"
              >
                −
              </button>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={actualHours}
                onChange={(e) => setActualHours(Math.max(0.5, Number(e.target.value)))}
                className="flex-1 text-center text-2xl font-bold text-secondary px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 outline-none"
              />
              <button
                type="button"
                onClick={() => setActualHours(h => h + 0.5)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
            <div className="text-center text-xs text-slate-400 mt-1">hours</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Notes (optional)</label>
            <textarea
              value={finishNotes}
              onChange={(e) => setFinishNotes(e.target.value)}
              placeholder="Any final notes about the job..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(actualHours, finishNotes)}
              className="flex-1 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Submit & Finish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, onUpdate }: { job: CaptainJob; onUpdate: () => void }) {
  const { mutateAsync: updateStatus } = useUpdateCaptainJobStatus();
  const { mutateAsync: addNote } = useAddCaptainNote();
  const [updating, setUpdating] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  const statusCfg = STATUS_CONFIG[job.status ?? "pending"] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const nextActions = getNextActions(job.status ?? "pending");
  const moveDate = job.quoteData?.moveDate || job.dateTime;

  const handleStatusUpdate = useCallback(async (newStatus: CaptainStatusUpdateRequestStatus, extraData?: { actualHours?: number; notes?: string }) => {
    setUpdating(newStatus);
    try {
      await updateStatus({
        jobId: job.jobId || job.id,
        data: {
          status: newStatus,
          ...(extraData?.actualHours !== undefined ? { actualHours: extraData.actualHours } : {}),
          ...(extraData?.notes ? { notes: extraData.notes } : {}),
        },
      });
      onUpdate();
    } catch {
      alert("Failed to update status");
    } finally {
      setUpdating(null);
    }
  }, [updateStatus, job, onUpdate]);

  const handleFinishConfirm = useCallback(async (actualHours: number, notes: string) => {
    setShowFinishModal(false);
    await handleStatusUpdate("finished" as CaptainStatusUpdateRequestStatus, { actualHours, notes });
  }, [handleStatusUpdate]);

  const handleAddNote = useCallback(async () => {
    if (!noteText.trim()) return;
    setSubmittingNote(true);
    try {
      await addNote({ jobId: job.jobId || job.id, data: { notes: noteText.trim() } });
      setNoteText("");
      setShowNotes(false);
      onUpdate();
    } catch {
      alert("Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  }, [addNote, job, noteText, onUpdate]);

  const isFinished = job.status === "finished" || job.status === "awaiting_remaining_balance";

  return (
    <>
      {showFinishModal && (
        <FinishJobModal
          job={job}
          onClose={() => setShowFinishModal(false)}
          onConfirm={handleFinishConfirm}
        />
      )}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-slate-400">{job.jobId}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {statusCfg.label}
                </span>
              </div>
              <h3 className="font-bold text-secondary text-lg truncate">{job.customer || job.quoteData?.contactName || "Customer"}</h3>
            </div>
            <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-slate-400">Pickup</div>
                <div className="text-slate-700 truncate">{job.pickupLocation || job.quoteData?.pickupAddress || "—"}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-slate-400">Dropoff</div>
                <div className="text-slate-700 truncate">{job.destination || job.quoteData?.dropoffAddress || "—"}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {moveDate
                ? new Date(moveDate.includes("T") ? moveDate : moveDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "TBD"}
            </span>
            {job.quoteData?.arrivalTimeWindow && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {job.quoteData.arrivalTimeWindow}
              </span>
            )}
            {(job.crewSize || job.quoteData?.crewSize) && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {job.crewSize || job.quoteData?.crewSize} crew
              </span>
            )}
          </div>
        </div>

        {expanded && (
          <div className="border-t border-slate-100 p-4 space-y-4">
            {isFinished && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 flex items-start gap-2">
                <DollarSign className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600" />
                <div>
                  <div className="font-semibold">Job Finished</div>
                  <div className="text-xs mt-0.5">Admin will send the balance invoice to the customer. No further action needed from you.</div>
                </div>
              </div>
            )}

            {job.quoteData && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {job.quoteData.numberOfBedrooms != null && (
                  <div className="text-slate-600">
                    <span className="text-xs text-slate-400 block">Bedrooms</span>
                    {job.quoteData.numberOfBedrooms}
                  </div>
                )}
                {job.estimatedHours != null && (
                  <div className="text-slate-600">
                    <span className="text-xs text-slate-400 block">{isFinished ? "Actual Hours" : "Est. Hours"}</span>
                    {job.estimatedHours}h
                  </div>
                )}
                {job.quoteData.hasStairs && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-medium">Has Stairs</span>}
                {job.quoteData.hasHeavyItems && <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg font-medium">Heavy Items</span>}
                {job.quoteData.storageNeeded && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-medium">Storage: {job.quoteData.storageUnitChoice || "Needed"}</span>}
              </div>
            )}

            {job.quoteData?.additionalNotes && (
              <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 italic">
                "{job.quoteData.additionalNotes}"
              </div>
            )}

            {job.notes && (
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs font-semibold text-slate-500 mb-1">Notes</div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">{job.notes}</div>
              </div>
            )}

            {nextActions.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">Update Status</div>
                <div className="flex flex-wrap gap-2">
                  {nextActions.map((actionStatus) => {
                    const action = CAPTAIN_ACTIONS.find((a) => a.status === actionStatus);
                    if (!action) return null;
                    const ActionIcon = action.icon;
                    return (
                      <button
                        key={action.status}
                        onClick={() => {
                          if (action.status === "finished") {
                            setShowFinishModal(true);
                          } else {
                            handleStatusUpdate(action.status as CaptainStatusUpdateRequestStatus);
                          }
                        }}
                        disabled={updating !== null}
                        className={`flex items-center gap-2 px-4 py-3 ${action.color} text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 active:scale-95`}
                      >
                        {updating === action.status ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ActionIcon className="w-4 h-4" />
                        )}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              {!showNotes ? (
                <button
                  onClick={() => setShowNotes(true)}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Add Note
                </button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add operational note..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/30 outline-none resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddNote}
                      disabled={submittingNote || !noteText.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {submittingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Save Note
                    </button>
                    <button
                      onClick={() => { setShowNotes(false); setNoteText(""); }}
                      className="px-4 py-2 text-slate-500 text-sm font-medium hover:text-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function CaptainDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { data: jobs = [], refetch } = useListCaptainJobs();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"today" | "upcoming" | "completed">("today");

  const handleUpdate = useCallback(() => {
    refetch();
    qc.invalidateQueries({ queryKey: ["/api/captain/jobs"] });
  }, [refetch, qc]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/admin/login");
  }, [logout, navigate]);

  const todayJobs = jobs.filter((j) => {
    const moveDate = j.quoteData?.moveDate || j.dateTime;
    const isCompleted = j.status === "complete" || j.status === "cancelled";
    return isToday(moveDate) && !isCompleted;
  });

  const activeJobs = jobs.filter((j) => {
    const status = j.status ?? "pending";
    return ["en_route", "arrived", "in_progress", "at_storage", "returning", "delayed", "finished", "awaiting_remaining_balance"].includes(status);
  });

  const upcomingJobs = jobs.filter((j) => {
    const moveDate = j.quoteData?.moveDate || j.dateTime;
    const isCompleted = j.status === "complete" || j.status === "cancelled";
    return !isCompleted && !isToday(moveDate) && (isFuture(moveDate) || !moveDate);
  });

  const completedJobs = jobs.filter((j) => j.status === "complete" || j.status === "cancelled");

  const displayJobs = activeTab === "today" ? [...activeJobs, ...todayJobs.filter((j) => !activeJobs.find((a) => a.id === j.id))] : activeTab === "upcoming" ? upcomingJobs : completedJobs;

  const tabs = [
    { key: "today" as const, label: "Today", count: todayJobs.length + activeJobs.filter((a) => !todayJobs.find((t) => t.id === a.id)).length },
    { key: "upcoming" as const, label: "Upcoming", count: upcomingJobs.length },
    { key: "completed" as const, label: "Completed", count: completedJobs.length },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-secondary text-white sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-sm tracking-wide">TEEMER</div>
              <div className="text-slate-400 text-xs">Captain Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-slate-400">Move Captain</div>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Sign Out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
            <div className="text-2xl font-bold text-primary">{todayJobs.length + activeJobs.filter((a) => !todayJobs.find((t) => t.id === a.id)).length}</div>
            <div className="text-xs text-slate-500">Active</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
            <div className="text-2xl font-bold text-blue-600">{upcomingJobs.length}</div>
            <div className="text-xs text-slate-500">Upcoming</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
            <div className="text-2xl font-bold text-green-600">{completedJobs.length}</div>
            <div className="text-xs text-slate-500">Completed</div>
          </div>
        </div>

        <div className="flex bg-white rounded-xl border border-slate-200 p-1 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-xs ${activeTab === tab.key ? "text-white/80" : "text-slate-400"}`}>
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {displayJobs.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 border-dashed">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-secondary mb-1">
                {activeTab === "today" ? "No Active Jobs" : activeTab === "upcoming" ? "No Upcoming Jobs" : "No Completed Jobs"}
              </h3>
              <p className="text-sm text-slate-500">
                {activeTab === "today" ? "Check back when you're assigned new jobs." : activeTab === "upcoming" ? "No future jobs scheduled yet." : "Completed jobs will appear here."}
              </p>
            </div>
          )}
          {displayJobs.map((job) => (
            <JobCard key={job.id} job={job} onUpdate={handleUpdate} />
          ))}
        </div>
      </div>
    </div>
  );
}
