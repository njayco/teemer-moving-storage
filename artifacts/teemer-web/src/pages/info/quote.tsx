import { InfoLayout } from "@/components/layout/info-layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitQuoteRequest } from "@workspace/api-client-react";
import { useState } from "react";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const quoteSchema = z.object({
  moveType: z.string().min(1, "Select a move type"),
  residentialOrCommercial: z.string().min(1, "Select move category"),
  originAddress: z.string().min(5, "Origin address is required"),
  destinationAddress: z.string().min(5, "Destination address is required"),
  moveDate: z.string().min(1, "Move date is required"),
  moveSize: z.string().min(1, "Select move size"),
  numberOfRooms: z.coerce.number().min(1, "Number of rooms required"),
  packingHelpNeeded: z.string().min(1, "Select packing help preference"),
  specialItems: z.string().optional(),
  storageNeeded: z.boolean().default(false),
  contactName: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone is required"),
  email: z.string().email("Valid email is required"),
  additionalNotes: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

export default function QuotePage() {
  const [step, setStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const mutation = useSubmitQuoteRequest();

  const { register, handleSubmit, formState: { errors }, trigger, watch } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { storageNeeded: false }
  });

  const nextStep = async () => {
    let valid = false;
    if (step === 1) valid = await trigger(["moveType", "residentialOrCommercial", "originAddress", "destinationAddress", "moveDate"]);
    if (step === 2) valid = await trigger(["moveSize", "numberOfRooms", "packingHelpNeeded"]);
    if (valid) setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  const onSubmit = (data: QuoteFormValues) => {
    mutation.mutate({ data }, {
      onSuccess: () => setIsSuccess(true),
      onError: (err) => console.error("Failed to submit quote:", err)
    });
  };

  return (
    <InfoLayout>
      <div className="bg-slate-50 py-16 min-h-[calc(100vh-80px)]">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold font-display text-secondary mb-4">Request a Free Quote</h1>
            <p className="text-slate-600">Fill out the details below and we'll get back to you with an estimated price.</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 md:p-12 border border-slate-100">
            {isSuccess ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-secondary mb-4">Quote Request Sent!</h2>
                <p className="text-slate-600 mb-8 text-lg">
                  Thank you, {watch("contactName")}! We have received your request and will contact you at {watch("phone")} shortly with your estimate.
                </p>
                <button 
                  onClick={() => window.location.href = '/info'}
                  className="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary/90 transition-colors"
                >
                  Return to Home
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                {/* Progress Bar */}
                <div className="flex justify-between items-center mb-8 relative">
                  <div className="absolute left-0 top-1/2 w-full h-1 bg-slate-100 -z-10 rounded-full"></div>
                  <div className="absolute left-0 top-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-300" style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                      step >= i ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-slate-200 text-slate-500"
                    }`}>
                      {i}
                    </div>
                  ))}
                </div>

                {/* Step 1: The Move */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-2xl font-bold text-secondary mb-6 border-b pb-4">1. Move Details</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Move Distance</label>
                        <select {...register("moveType")} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                          <option value="">Select type...</option>
                          <option value="Local">Local (under 50 miles)</option>
                          <option value="Long Distance">Long Distance</option>
                        </select>
                        {errors.moveType && <p className="text-red-500 text-sm mt-1">{errors.moveType.message}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Category</label>
                        <select {...register("residentialOrCommercial")} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                          <option value="">Select category...</option>
                          <option value="Residential">Residential</option>
                          <option value="Commercial">Commercial (Office)</option>
                        </select>
                        {errors.residentialOrCommercial && <p className="text-red-500 text-sm mt-1">{errors.residentialOrCommercial.message}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Moving From (Zip/City)</label>
                        <input {...register("originAddress")} placeholder="e.g. Long Beach, 11561" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                        {errors.originAddress && <p className="text-red-500 text-sm mt-1">{errors.originAddress.message}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Moving To (Zip/City)</label>
                        <input {...register("destinationAddress")} placeholder="e.g. Brooklyn, 11201" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                        {errors.destinationAddress && <p className="text-red-500 text-sm mt-1">{errors.destinationAddress.message}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-secondary mb-2">Planned Move Date</label>
                      <input type="date" {...register("moveDate")} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                      {errors.moveDate && <p className="text-red-500 text-sm mt-1">{errors.moveDate.message}</p>}
                    </div>

                    <div className="flex justify-end pt-4">
                      <button type="button" onClick={nextStep} className="bg-secondary text-white px-8 py-4 rounded-xl font-bold hover:bg-secondary/90 flex items-center transition-colors">
                        Next Step <ArrowRight className="ml-2 w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Inventory */}
                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-2xl font-bold text-secondary mb-6 border-b pb-4">2. Size & Services</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Property Size</label>
                        <select {...register("moveSize")} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                          <option value="">Select size...</option>
                          <option value="Studio">Studio</option>
                          <option value="1 Bedroom">1 Bedroom</option>
                          <option value="2 Bedrooms">2 Bedrooms</option>
                          <option value="3 Bedrooms">3 Bedrooms</option>
                          <option value="4+ Bedrooms">4+ Bedrooms / House</option>
                          <option value="Office">Office Space</option>
                        </select>
                        {errors.moveSize && <p className="text-red-500 text-sm mt-1">{errors.moveSize.message}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Total Rooms</label>
                        <input type="number" {...register("numberOfRooms")} min="1" placeholder="e.g. 4" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                        {errors.numberOfRooms && <p className="text-red-500 text-sm mt-1">{errors.numberOfRooms.message}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-secondary mb-2">Do you need packing help?</label>
                      <select {...register("packingHelpNeeded")} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all">
                        <option value="">Select preference...</option>
                        <option value="Full Packing">Yes, Full Service Packing</option>
                        <option value="Partial Packing">Partial (Just fragile/kitchen)</option>
                        <option value="None">No, I will pack myself</option>
                      </select>
                      {errors.packingHelpNeeded && <p className="text-red-500 text-sm mt-1">{errors.packingHelpNeeded.message}</p>}
                    </div>

                    <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <input type="checkbox" id="storage" {...register("storageNeeded")} className="w-5 h-5 text-primary rounded border-slate-300 focus:ring-primary" />
                      <label htmlFor="storage" className="font-medium text-secondary">I might need temporary storage services</label>
                    </div>

                    <div className="flex justify-between pt-4">
                      <button type="button" onClick={prevStep} className="text-slate-500 font-bold px-6 py-4 hover:bg-slate-100 rounded-xl transition-colors">
                        Back
                      </button>
                      <button type="button" onClick={nextStep} className="bg-secondary text-white px-8 py-4 rounded-xl font-bold hover:bg-secondary/90 flex items-center transition-colors">
                        Next Step <ArrowRight className="ml-2 w-5 h-5" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Contact */}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h3 className="text-2xl font-bold text-secondary mb-6 border-b pb-4">3. Contact Info</h3>
                    
                    <div>
                      <label className="block text-sm font-semibold text-secondary mb-2">Full Name</label>
                      <input {...register("contactName")} placeholder="John Doe" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                      {errors.contactName && <p className="text-red-500 text-sm mt-1">{errors.contactName.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Phone Number</label>
                        <input {...register("phone")} placeholder="(555) 123-4567" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                        {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-secondary mb-2">Email Address</label>
                        <input type="email" {...register("email")} placeholder="john@example.com" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" />
                        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-secondary mb-2">Special Items & Notes</label>
                      <textarea {...register("additionalNotes")} placeholder="Pianos, safes, fine art, or special building requirements (e.g., COI needed, elevator reservations)..." rows={4} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"></textarea>
                    </div>

                    {mutation.isError && (
                      <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">
                        An error occurred while submitting your request. Please try again.
                      </div>
                    )}

                    <div className="flex justify-between pt-4">
                      <button type="button" onClick={prevStep} className="text-slate-500 font-bold px-6 py-4 hover:bg-slate-100 rounded-xl transition-colors">
                        Back
                      </button>
                      <button 
                        type="submit" 
                        disabled={mutation.isPending}
                        className="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary/90 flex items-center transition-all shadow-lg shadow-primary/20 disabled:opacity-70"
                      >
                        {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Request"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
