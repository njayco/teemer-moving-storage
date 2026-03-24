import { PlatformLayout } from "@/components/layout/platform-layout";
import { useListJobs, useUpdateJobStatus } from "@workspace/api-client-react";
import { MapPin, Calendar, DollarSign, Package, ExternalLink, RefreshCw, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function ProviderPortal() {
  const { data: jobs, isLoading, refetch } = useListJobs({});
  const updateMutation = useUpdateJobStatus();

  const handleAcceptJob = (jobId: string) => {
    if (confirm("Are you sure you want to accept this job?")) {
      updateMutation.mutate({ jobId, data: { status: "Crew Assigned", assignedMover: "Current Provider" } }, {
        onSuccess: () => refetch()
      });
    }
  };

  return (
    <PlatformLayout role="provider">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Main Feed */}
        <div className="flex-1">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-bold font-display text-secondary mb-2">Job Marketplace</h1>
              <p className="text-slate-500">Find and claim open moving requests in your area.</p>
            </div>
            <button onClick={() => refetch()} className="p-2 text-slate-400 hover:text-primary transition-colors" title="Refresh Feed">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-8">
            {["All Areas", "Long Island", "NYC", "Local Only", "Long Distance"].map(f => (
              <span key={f} className="px-4 py-2 bg-white border border-border rounded-full text-sm font-medium text-slate-600 cursor-pointer hover:border-primary hover:text-primary transition-colors">
                {f}
              </span>
            ))}
          </div>

          <div className="space-y-6">
            {isLoading ? (
              [1,2,3].map(i => <div key={i} className="bg-white h-48 rounded-3xl animate-pulse" />)
            ) : jobs && jobs.length > 0 ? (
              jobs.map(job => (
                <div key={job.id} className="bg-white rounded-3xl p-6 border border-border hover:shadow-lg hover:border-slate-300 transition-all group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-xl">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{job.moveType}</span>
                        <h3 className="font-bold text-lg text-secondary">{job.jobSize || "Standard Move"}</h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-green-600 flex items-center justify-end">
                        <DollarSign className="w-5 h-5" />{job.estimatedPayout}
                      </span>
                      <span className="text-xs text-slate-500 uppercase font-semibold">Est. Payout</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 bg-slate-50 p-4 rounded-xl">
                    <div className="space-y-3">
                      <div className="flex">
                        <MapPin className="w-4 h-4 text-slate-400 mr-2 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-500">Pickup</p>
                          <p className="text-sm font-medium text-secondary">{job.pickupLocation}</p>
                        </div>
                      </div>
                      <div className="flex">
                        <MapPin className="w-4 h-4 text-primary mr-2 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-500">Destination</p>
                          <p className="text-sm font-medium text-secondary">{job.destination}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex">
                        <Calendar className="w-4 h-4 text-slate-400 mr-2 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-500">Date & Time</p>
                          <p className="text-sm font-medium text-secondary">{format(new Date(job.dateTime), "PPP")}</p>
                        </div>
                      </div>
                      {job.specialRequirements && (
                        <div className="flex">
                          <ExternalLink className="w-4 h-4 text-amber-500 mr-2 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-amber-600 font-semibold">Special Req</p>
                            <p className="text-sm text-secondary">{job.specialRequirements}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button className="px-6 py-2.5 text-secondary font-semibold hover:bg-slate-100 rounded-xl transition-colors">
                      View Details
                    </button>
                    <button 
                      onClick={() => handleAcceptJob(job.id)}
                      disabled={updateMutation.isPending}
                      className="px-8 py-2.5 bg-primary text-white font-bold rounded-xl shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                      Accept Job
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-border border-dashed">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-secondary mb-2">No Open Jobs Found</h3>
                <p className="text-slate-500">Check back later or adjust your area filters.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="w-full lg:w-80 space-y-6">
          <div className="bg-secondary text-white p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
            <h3 className="font-bold font-display text-lg mb-6 relative z-10">Business at a Glance</h3>
            
            <div className="space-y-6 relative z-10">
              <div>
                <p className="text-slate-400 text-sm mb-1">Weekly Earnings</p>
                <p className="text-3xl font-bold text-white">$2,450</p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3">
                  <div className="bg-primary w-2/3 h-full rounded-full"></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-xl">
                  <Clock className="w-5 h-5 text-primary mb-2" />
                  <p className="text-2xl font-bold">3</p>
                  <p className="text-xs text-slate-400">Jobs Today</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-400 mb-2" />
                  <p className="text-2xl font-bold">98%</p>
                  <p className="text-xs text-slate-400">Completion</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-border">
            <h3 className="font-bold text-secondary mb-4">Upcoming Schedule</h3>
            <div className="space-y-4">
              {[1,2].map(i => (
                <div key={i} className="flex items-center border-l-2 border-primary pl-4 py-1">
                  <div>
                    <p className="text-sm font-bold text-secondary">Tomorrow, 8:00 AM</p>
                    <p className="text-xs text-slate-500">Long Beach → Brooklyn</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 text-sm font-semibold text-primary bg-primary/5 rounded-lg hover:bg-primary/10 transition-colors">
              View Calendar
            </button>
          </div>
        </div>

      </div>
    </PlatformLayout>
  );
}
