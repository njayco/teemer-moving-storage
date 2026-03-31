import { InfoLayout } from "@/components/layout/info-layout";
import { companyInfo } from "@/lib/mock-data";
import { MapPin } from "lucide-react";

export default function ServiceAreaPage() {
  return (
    <InfoLayout>
      <div className="bg-slate-50 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-secondary mb-6">Areas We Serve</h1>
          <p className="text-lg text-slate-600 mb-10">
            Based in Long Beach, Teemer Moving & Storage Corp. proudly provides premium moving services across Long Island and New York City boroughs.
          </p>

          {/* Banner image */}
          <div className="rounded-3xl overflow-hidden shadow-md border border-slate-100 h-64 md:h-80 mb-12">
            <img
              src={`${import.meta.env.BASE_URL}images/IMG_1960.jpg`}
              alt="Teemer Moving crew on a professional commercial move in the New York metro area"
              className="w-full h-full object-cover object-center"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {companyInfo.serviceAreas.map(area => (
              <div key={area} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center hover:border-primary transition-colors cursor-default">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <MapPin className="w-6 h-6" />
                </div>
                <span className="font-bold text-secondary text-lg">{area}</span>
              </div>
            ))}
          </div>

          {/* Photo pair */}
          <div className="mt-12 grid grid-cols-2 gap-4">
            <div className="rounded-2xl overflow-hidden h-52 shadow-sm border border-slate-100">
              <img
                src={`${import.meta.env.BASE_URL}images/IMG_4598.jpg`}
                alt="Teemer crew moving large items at a Long Island location"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="rounded-2xl overflow-hidden h-52 shadow-sm border border-slate-100">
              <img
                src={`${import.meta.env.BASE_URL}images/IMG_4628.jpg`}
                alt="Teemer crew providing specialty moving services in the NYC metro area"
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>

          <div className="mt-12 p-8 bg-primary/10 rounded-3xl border border-primary/20">
            <h3 className="text-2xl font-bold text-secondary mb-4">Moving somewhere else?</h3>
            <p className="text-slate-600 mb-6">We also handle long-distance moves outside these core areas. Contact us to discuss your specific destination.</p>
            <a href={`tel:${companyInfo.phone}`} className="inline-block bg-primary text-white font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition-colors">
              Call {companyInfo.phone}
            </a>
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
