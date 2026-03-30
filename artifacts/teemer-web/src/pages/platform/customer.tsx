import { PlatformLayout } from "@/components/layout/platform-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGetJob, useSubmitQuoteRequest } from "@workspace/api-client-react";
import { useState } from "react";
import { MapPin, Search, CheckCircle2, Clock, Truck, Loader2 } from "lucide-react";
import { format } from "date-fns";

const STAGES = [
  "Request Submitted",
  "Quote Sent",
  "Booking Confirmed",
  "Crew Assigned",
  "En Route",
  "Loading",
  "In Transit",
  "Delivered",
  "Completed"
];

function JobTracker({ jobId }: { jobId: string }) {
  const { data: job, isLoading, isError } = useGetJob(jobId);

  if (isLoading) return <div className="p-12 text-center text-slate-500 flex flex-col items-center"><Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" /> Loading job details...</div>;
  if (isError || !job) return <div className="p-12 text-center text-red-500">Job not found or tracking code is invalid.</div>;

  const currentStageIndex = STAGES.indexOf(job.status);

  return (
    <div className="bg-white rounded-3xl p-8 border border-border shadow-sm">
      <div className="flex justify-between items-start mb-8 border-b pb-8">
        <div>
          <h2 className="text-2xl font-bold font-display text-secondary mb-2">Move Tracker</h2>
          <p className="text-slate-500 font-mono text-sm tracking-wider">JOB ID: {job.jobId || job.id}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500 mb-1">Scheduled For</p>
          <p className="font-bold text-secondary">{format(new Date(job.dateTime), "PPP p")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="col-span-2 relative">
          <div className="absolute left-6 top-8 bottom-8 w-1 bg-slate-100 -z-10" />
          <div className="space-y-6">
            {STAGES.map((stage, idx) => {
              const isCompleted = idx <= currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              return (
                <div key={stage} className={`flex items-center ${isCompleted ? "opacity-100" : "opacity-40"}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 mr-6 bg-white transition-colors ${
                    isCurrent ? "border-primary text-primary" :
                    isCompleted ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-300"
                  }`}>
                    {isCompleted && !isCurrent ? <CheckCircle2 className="w-5 h-5" /> : 
                     isCurrent ? <Truck className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className={`text-lg font-bold ${isCurrent ? "text-primary" : "text-secondary"}`}>{stage}</h4>
                    {isCurrent && <p className="text-sm text-slate-500 mt-1">Current Status</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6">
            <h4 className="font-bold text-secondary mb-4 uppercase tracking-wide text-sm">Route</h4>
            <div className="space-y-4">
              <div className="flex">
                <MapPin className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Origin</p>
                  <p className="font-medium text-secondary">{job.pickupLocation}</p>
                </div>
              </div>
              <div className="h-6 ml-2 border-l-2 border-dashed border-slate-300"></div>
              <div className="flex">
                <MapPin className="w-5 h-5 text-primary mr-3 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Destination</p>
                  <p className="font-medium text-secondary">{job.destination}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20">
            <h4 className="font-bold text-secondary mb-2 uppercase tracking-wide text-sm">Crew Info</h4>
            {job.assignedMover ? (
              <p className="font-medium text-primary flex items-center"><Truck className="w-4 h-4 mr-2" /> {job.assignedMover}</p>
            ) : (
              <p className="text-slate-500 italic text-sm">Crew will be assigned 24 hours prior to move.</p>
            )}
            {job.eta && (
              <div className="mt-4 pt-4 border-t border-primary/10">
                <p className="text-xs text-slate-500 uppercase">Estimated Arrival</p>
                <p className="font-bold text-lg text-secondary">{job.eta}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomerPortal() {
  const [activeTab, setActiveTab] = useState<"request" | "track">("request");
  const [trackCode, setTrackCode] = useState("");
  const [activeTrackingJob, setActiveTrackingJob] = useState<string | null>(null);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackCode.trim()) setActiveTrackingJob(trackCode.trim());
  };

  return (
    <PlatformLayout role="customer">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold font-display text-secondary mb-2">Welcome Back</h1>
        <p className="text-slate-500 mb-8">Manage your quotes and track your active moves.</p>

        <div className="flex space-x-2 mb-8 bg-slate-200/50 p-1 rounded-xl w-max">
          <button 
            onClick={() => setActiveTab("request")}
            className={`px-6 py-2.5 rounded-lg font-bold transition-all ${activeTab === "request" ? "bg-white text-secondary shadow-sm" : "text-slate-500 hover:text-secondary"}`}
          >
            Request New Move
          </button>
          <button 
            onClick={() => setActiveTab("track")}
            className={`px-6 py-2.5 rounded-lg font-bold transition-all ${activeTab === "track" ? "bg-white text-secondary shadow-sm" : "text-slate-500 hover:text-secondary"}`}
          >
            Track Active Job
          </button>
        </div>

        {activeTab === "request" ? (
          <div className="bg-white rounded-3xl p-8 border border-border shadow-sm flex flex-col items-center justify-center text-center py-16">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Truck className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-secondary mb-4">Start a New Move Request</h2>
            <p className="text-slate-500 mb-8 max-w-md">Our multi-step quote wizard on the main site will guide you through getting an accurate estimate.</p>
            <button 
              onClick={() => window.location.href = '/info/quote'}
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 transition-all"
            >
              Open Quote Wizard
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {!activeTrackingJob ? (
              <div className="bg-white rounded-3xl p-8 border border-border shadow-sm py-16">
                <div className="max-w-md mx-auto text-center">
                  <h2 className="text-2xl font-bold text-secondary mb-4">Track Your Move</h2>
                  <p className="text-slate-500 mb-8">Enter your Job ID to see real-time status and truck location.</p>
                  <form onSubmit={handleTrackSubmit} className="flex">
                    <input 
                      type="text" 
                      value={trackCode}
                      onChange={(e) => setTrackCode(e.target.value)}
                      placeholder="e.g. JOB-12345" 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-l-xl px-6 py-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono text-lg"
                    />
                    <button type="submit" className="bg-secondary text-white px-8 py-4 rounded-r-xl font-bold hover:bg-secondary/90 flex items-center">
                      <Search className="w-5 h-5 mr-2" /> Track
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div>
                <button 
                  onClick={() => setActiveTrackingJob(null)}
                  className="mb-4 text-primary font-medium hover:underline text-sm"
                >
                  &larr; Track a different job
                </button>
                <JobTracker jobId={activeTrackingJob} />
              </div>
            )}
          </div>
        )}
      </div>
    </PlatformLayout>
  );
}
