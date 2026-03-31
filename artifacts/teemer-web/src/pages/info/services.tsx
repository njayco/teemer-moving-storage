import { InfoLayout } from "@/components/layout/info-layout";
import { services } from "@/lib/mock-data";
import { PackageOpen, Building2, Home, Truck, ShieldCheck, Warehouse, Music } from "lucide-react";
import { Link } from "wouter";

const iconMap: Record<string, React.ElementType> = {
  residential: Home,
  commercial: Building2,
  packing: PackageOpen,
  storage: Warehouse,
  piano: Music,
  "long-distance": Truck
};

const serviceImages: Record<string, string> = {
  residential: "IMG_4015.jpg",
  commercial: "IMG_1960.jpg",
  packing: "IMG_4525.jpg",
  storage: "IMG_3913.jpg",
  piano: "IMG_4628.jpg",
  "long-distance": "IMG_4598.jpg",
};

export default function ServicesPage() {
  return (
    <InfoLayout>
      <div className="bg-slate-50 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <h1 className="text-4xl md:text-5xl font-bold font-display text-secondary mb-6">Our Moving Services</h1>
            <p className="text-lg text-slate-600">
              From packing the first box to placing the last piece of furniture, our professional crews handle every aspect of your move.
            </p>
          </div>

          {/* Hero image banner */}
          <div className="rounded-3xl overflow-hidden shadow-md border border-slate-100 h-64 md:h-80 mb-6">
            <img
              src={`${import.meta.env.BASE_URL}images/IMG_1927.jpg`}
              alt="Teemer Moving & Storage Corp. full crew on a commercial job"
              className="w-full h-full object-cover object-center"
            />
          </div>

          {/* Photo strip */}
          <div className="grid grid-cols-3 gap-4 mb-14">
            <div className="rounded-2xl overflow-hidden h-36 shadow-sm border border-slate-100">
              <img
                src={`${import.meta.env.BASE_URL}images/IMG_3913.jpg`}
                alt="Teemer crew handling a residential move"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="rounded-2xl overflow-hidden h-36 shadow-sm border border-slate-100">
              <img
                src={`${import.meta.env.BASE_URL}images/IMG_4598.jpg`}
                alt="Teemer crew carrying furniture on a commercial move"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="rounded-2xl overflow-hidden h-36 shadow-sm border border-slate-100">
              <img
                src={`${import.meta.env.BASE_URL}images/IMG_1914.jpg`}
                alt="Teemer crew member installing fixtures"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Service cards with images */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service) => {
              const Icon = iconMap[service.id] || ShieldCheck;
              const imgFile = serviceImages[service.id];
              return (
                <div key={service.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                  {imgFile && (
                    <div className="h-44 overflow-hidden">
                      <img
                        src={`${import.meta.env.BASE_URL}images/${imgFile}`}
                        alt={`Teemer Moving — ${service.title}`}
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                  )}
                  <div className="p-8">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-secondary mb-4">{service.title}</h3>
                    <p className="text-slate-600 mb-6 line-clamp-3">{service.shortDesc}</p>
                    <Link href="/info/quote" className="inline-block border-2 border-primary text-primary font-bold px-6 py-2 rounded-xl hover:bg-primary hover:text-white transition-colors">
                      Request Quote
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
