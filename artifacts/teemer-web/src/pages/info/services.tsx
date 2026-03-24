import { InfoLayout } from "@/components/layout/info-layout";
import { services } from "@/lib/mock-data";
import { PackageOpen, Building2, Home, Truck, ShieldCheck, Warehouse, Music } from "lucide-react";
import { Link } from "wouter";

// Helper map to pick a nice icon based on ID
const iconMap: Record<string, React.ElementType> = {
  residential: Home,
  commercial: Building2,
  packing: PackageOpen,
  storage: Warehouse,
  piano: Music,
  "long-distance": Truck
};

export default function ServicesPage() {
  return (
    <InfoLayout>
      <div className="bg-slate-50 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-bold font-display text-secondary mb-6">Our Moving Services</h1>
            <p className="text-lg text-slate-600">
              From packing the first box to placing the last piece of furniture, our professional crews handle every aspect of your move.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service) => {
              const Icon = iconMap[service.id] || ShieldCheck;
              return (
                <div key={service.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                    <Icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-secondary mb-4">{service.title}</h3>
                  <p className="text-slate-600 mb-6 line-clamp-3">{service.shortDesc}</p>
                  <Link href="/info/quote" className="inline-block border-2 border-primary text-primary font-bold px-6 py-2 rounded-xl hover:bg-primary hover:text-white transition-colors">
                    Request Quote
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
