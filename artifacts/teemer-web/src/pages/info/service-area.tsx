import { InfoLayout } from "@/components/layout/info-layout";
import { companyInfo } from "@/lib/mock-data";
import { MapPin } from "lucide-react";

export default function ServiceAreaPage() {
  return (
    <InfoLayout>
      <div className="bg-slate-50 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-secondary mb-6">Areas We Serve</h1>
          <p className="text-lg text-slate-600 mb-16">
            Based in Long Beach, Teemer Moving & Storage proudly provides premium moving services across Long Island and New York City boroughs.
          </p>
          
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

          <div className="mt-16 p-8 bg-primary/10 rounded-3xl border border-primary/20">
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
