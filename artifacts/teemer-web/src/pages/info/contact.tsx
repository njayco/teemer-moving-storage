import { InfoLayout } from "@/components/layout/info-layout";
import { companyInfo } from "@/lib/mock-data";
import { Phone, MapPin, Mail, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitContactForm } from "@workspace/api-client-react";
import { useState } from "react";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(10, "Valid phone required"),
  message: z.string().min(10, "Message must be at least 10 characters")
});

export default function ContactPage() {
  const [success, setSuccess] = useState(false);
  const mutation = useSubmitContactForm();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema)
  });

  const onSubmit = (data: z.infer<typeof contactSchema>) => {
    mutation.mutate({ data }, {
      onSuccess: () => {
        setSuccess(true);
        reset();
      }
    });
  };

  return (
    <InfoLayout>
      <div className="bg-slate-50 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold font-display text-secondary mb-6">Contact Us</h1>
            <p className="text-lg text-slate-600 mb-10">
              Have questions or ready to book your move? Reach out to our team directly.
            </p>
            
            <div className="space-y-6 mb-10">
              <div className="flex items-start">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mr-6 text-primary flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-secondary mb-1">Phone</h3>
                  <a href={`tel:${companyInfo.phone}`} className="text-slate-600 hover:text-primary transition-colors text-lg">{companyInfo.phone}</a>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mr-6 text-primary flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-secondary mb-1">Email</h3>
                  <a href={`mailto:${companyInfo.email}`} className="text-slate-600 hover:text-primary transition-colors text-lg">{companyInfo.email}</a>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mr-6 text-primary flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-secondary mb-1">Office</h3>
                  <p className="text-slate-600 text-lg">{companyInfo.location}</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mr-6 text-primary flex-shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-secondary mb-2">Hours</h3>
                  <table className="text-sm w-full border-collapse">
                    <tbody>
                      {[
                        { day: "Monday",    time: "7:00 AM – 6:00 PM" },
                        { day: "Tuesday",   time: "7:00 AM – 6:00 PM" },
                        { day: "Wednesday", time: "7:00 AM – 6:00 PM" },
                        { day: "Thursday",  time: "7:00 AM – 6:00 PM" },
                        { day: "Friday",    time: "7:00 AM – 6:00 PM" },
                        { day: "Saturday",  time: "By Appointment" },
                        { day: "Sunday",    time: "By Appointment" },
                      ].map(({ day, time }) => (
                        <tr key={day} className="border-b border-slate-100 last:border-0">
                          <td className="py-1 pr-4 text-slate-500 font-medium w-28">{day}</td>
                          <td className={`py-1 font-semibold ${time === "By Appointment" ? "text-slate-400" : "text-slate-700"}`}>{time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Crew photo */}
            <div className="rounded-2xl overflow-hidden shadow-md border border-slate-100 h-64">
              <img
                src={`${import.meta.env.BASE_URL}images/IMG_1927.jpg`}
                alt="The Teemer Moving & Storage Corp. crew ready to help with your move"
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>

          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
            {success ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-secondary mb-2">Message Sent!</h3>
                <p className="text-slate-600 mb-8">Thanks for reaching out. A team member will contact you shortly.</p>
                <button onClick={() => setSuccess(false)} className="text-primary font-bold hover:underline">Send another message</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <h3 className="text-2xl font-bold text-secondary mb-6">Send a Message</h3>
                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2">Full Name</label>
                  <input {...register("name")} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2">Email Address</label>
                    <input type="email" {...register("email")} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-2">Phone Number</label>
                    <input type="tel" {...register("phone")} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                    {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2">Message</label>
                  <textarea {...register("message")} rows={4} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"></textarea>
                  {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>}
                </div>
                <button type="submit" disabled={mutation.isPending} className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-primary/90 transition-all flex justify-center items-center">
                  {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
