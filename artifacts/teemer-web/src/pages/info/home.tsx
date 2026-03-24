import { InfoLayout } from "@/components/layout/info-layout";
import { Link } from "wouter";
import { companyInfo, services, testimonials } from "@/lib/mock-data";
import { ArrowRight, Star, ShieldCheck, Phone, CheckCircle2, Award, Truck, Home, Building2 } from "lucide-react";
import { motion } from "framer-motion";

const SERVICE_CARDS = [
  {
    id: "residential",
    title: "Residential Moving",
    desc: "Local and long-distance home moves. Care at every step.",
    photo: "/images/IMG_1923.jpg",
  },
  {
    id: "commercial",
    title: "Commercial Moving",
    desc: "Efficient business relocations with minimal downtime.",
    photo: "/images/IMG_4015.jpg",
  },
  {
    id: "storage",
    title: "Storage Solutions",
    desc: "Climate-controlled storage for short or long-term needs.",
    photo: "/images/IMG_2975.jpg",
  },
];

const WHY_CHOOSE = [
  "Licensed & Fully Insured",
  "Experienced & Uniformed Crews",
  "Modern Trucks & Equipment",
  "Transparent, No-Surprise Pricing",
  "Award-Winning Service",
  "Senior & Veteran Discounts",
];

const AWARDS = [
  { label: "A+", sub: "BBB Rating", big: true },
  { label: "NYSDOT", sub: "Licensed", big: false },
  { label: "LI Choice", sub: "Award Winner", big: false },
  { label: "Fully", sub: "Insured", big: false },
  { label: "5-Star", sub: "Google Rating", big: false },
];

export default function InfoHomePage() {
  return (
    <InfoLayout>
      {/* Discount Banner */}
      <div className="bg-primary text-white text-center text-sm font-bold py-2 tracking-widest uppercase">
        10% Discount for Seniors &amp; Veterans
      </div>

      {/* Hero + Why Choose Us — split layout */}
      <section className="grid grid-cols-1 lg:grid-cols-5 min-h-[520px]">
        {/* Left: Dark Hero */}
        <div className="lg:col-span-3 relative bg-secondary overflow-hidden flex flex-col justify-center py-16 px-8 md:px-12">
          {/* Background photo collage */}
          <div className="absolute inset-0">
            <img
              src="/images/IMG_1914.jpg"
              alt="Teemer crew"
              className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-secondary via-secondary/90 to-secondary/60" />
          </div>

          {/* Crew photo cluster — top right of hero */}
          <div className="absolute right-0 top-0 bottom-0 w-2/5 hidden lg:grid grid-rows-2 gap-1 p-1 opacity-70">
            <img src="/images/IMG_1918.jpg" alt="Teemer crew" className="w-full h-full object-cover" />
            <img src="/images/IMG_1960.jpg" alt="Teemer crew" className="w-full h-full object-cover" />
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-2/5 bg-gradient-to-l from-transparent to-secondary/80 pointer-events-none hidden lg:block" />

          <div className="relative z-10 max-w-lg">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold font-display text-white leading-tight mb-4">
                Make Moving<br />a Breeze
              </h1>
              <p className="text-lg text-white/80 font-semibold mb-2">
                Your Trusted Long Island &amp; NYC Moving Experts
              </p>
              <p className="text-slate-300 text-sm mb-8">
                Serving Long Beach, Nassau County, Suffolk County, Manhattan, Queens, and Brooklyn, NY. Licensed, Insured &amp; Award-Winning Service.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/info/quote"
                  className="bg-primary text-white px-7 py-3 rounded-lg font-bold text-base shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all text-center"
                >
                  Get a Free Quote
                </Link>
                <a
                  href={`tel:${companyInfo.phone}`}
                  className="border-2 border-white/40 text-white px-7 py-3 rounded-lg font-bold text-base hover:bg-white/10 transition-all text-center"
                >
                  Call Us: {companyInfo.phone}
                </a>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right: Why Choose Us */}
        <div className="lg:col-span-2 bg-white flex flex-col">
          <div className="p-8 border-b border-slate-100">
            <h2 className="text-lg font-extrabold text-secondary uppercase tracking-wide mb-5">
              The Teemer Difference:<br />Why Choose Us?
            </h2>
            <ul className="space-y-3">
              {WHY_CHOOSE.map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-slate-700 font-medium text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative flex-1 min-h-[200px] overflow-hidden">
            <img
              src="/images/IMG_4047.jpg"
              alt="Teemer crew carrying furniture"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-secondary/80 to-transparent flex items-end p-6">
              <p className="text-white font-bold text-lg font-display italic leading-snug">
                "Our promise is<br />care in every step."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-50 py-12 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-center text-xl font-extrabold text-secondary uppercase tracking-widest mb-8">
            Hear From Our Satisfied Customers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.slice(0, 3).map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{t.location}</p>
                <p className="text-slate-700 text-sm mb-3 leading-relaxed">"{t.text}"</p>
                <div className="flex text-amber-400">
                  {[...Array(t.rating)].map((_, idx) => (
                    <Star key={idx} className="fill-current w-4 h-4" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Award-Winning Team */}
      <section className="bg-white py-10 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-center text-xl font-extrabold text-secondary uppercase tracking-widest mb-8">
            An Award-Winning Team
          </h2>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {/* A+ Rating */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-2">
                <span className="text-white font-extrabold text-2xl">A+</span>
              </div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide text-center">Rating</span>
            </div>

            {/* NYSDOT Licensed */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mb-2">
                <span className="text-primary font-extrabold text-xs text-center leading-tight">NY<br/>SDOT</span>
              </div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide text-center">Licensed</span>
            </div>

            {/* Long Island Choice Awards */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-400 flex flex-col items-center justify-center mb-2 px-1">
                <Award className="w-5 h-5 text-amber-500 mb-0.5" />
                <span className="text-amber-700 font-extrabold text-xs text-center leading-tight">Long Island<br/>Choice<br/>Awards</span>
              </div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide text-center">Winner</span>
            </div>

            {/* Fully Insured */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mb-2">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide text-center">Fully<br/>Insured</span>
            </div>

            {/* 5-Star Google */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-400 flex flex-col items-center justify-center mb-2">
                <Star className="fill-amber-400 text-amber-400 w-6 h-6 mb-0.5" />
                <span className="text-amber-700 font-extrabold text-xs">5-Star</span>
              </div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide text-center">Google<br/>Rating</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services — Photo Cards */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-center text-2xl md:text-3xl font-extrabold text-secondary uppercase tracking-wide mb-10">
            Our Comprehensive Moving &amp; Storage Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SERVICE_CARDS.map((svc, i) => (
              <motion.div
                key={svc.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
              >
                <div className="aspect-[4/3] relative">
                  <img
                    src={svc.photo}
                    alt={svc.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-secondary/30 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="text-white font-extrabold text-xl mb-1">{svc.title}</h3>
                  <p className="text-white/80 text-sm mb-3">{svc.desc}</p>
                  <Link
                    href="/info/services"
                    className="inline-flex items-center text-primary font-bold text-sm hover:underline"
                  >
                    Learn More <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/info/services" className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-3 rounded-xl font-bold hover:bg-secondary/90 transition-colors">
              View All Services <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Crew in Action Photo Strip */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["/images/IMG_3913.jpg", "/images/IMG_4525.jpg", "/images/IMG_4598.jpg", "/images/IMG_4628.jpg"].map((src, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                <img src={src} alt="Teemer crew in action" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/info/gallery" className="inline-flex items-center text-primary font-bold hover:underline">
              See Full Gallery <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-secondary py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-white mb-3 uppercase leading-tight">
            Ready for a Stress-Free Move?<br />
            <span className="text-primary">Let Teemer Take the Heavy Lifting.</span>
          </h2>
          <p className="text-slate-300 mb-8 text-lg">Get your free, no-obligation estimate today.</p>
          <Link
            href="/info/quote"
            className="inline-block bg-primary text-white px-10 py-4 rounded-xl font-extrabold text-lg shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all mb-4"
          >
            Start Your Free Quote Now
          </Link>
          <p className="text-slate-400 text-sm">
            Or call us: <a href={`tel:${companyInfo.phone}`} className="text-white font-bold hover:underline">{companyInfo.phone}</a>
          </p>
        </div>
      </section>
    </InfoLayout>
  );
}
