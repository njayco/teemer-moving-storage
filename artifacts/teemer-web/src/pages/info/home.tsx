import { InfoLayout } from "@/components/layout/info-layout";
import { Link } from "wouter";
import { companyInfo, testimonials } from "@/lib/mock-data";
import { ArrowRight, Star, ShieldCheck, CheckCircle2, Award, Home, Building2, Warehouse } from "lucide-react";
import { motion } from "framer-motion";

const WHY_CHOOSE = [
  "Licensed & Fully Insured",
  "Experienced & Uniformed Crews",
  "Modern Trucks & Equipment",
  "Transparent, No-Surprise Pricing",
  "Award-Winning Service",
  "Senior & Veteran Discounts",
];

const SERVICE_CARDS = [
  {
    id: "residential",
    title: "Residential Moving",
    desc: "Local and long-distance home moves. Care at every step.",
    photo: "/images/IMG_1923.jpg",
    Icon: Home,
  },
  {
    id: "commercial",
    title: "Commercial Moving",
    desc: "Efficient business relocations with minimal downtime.",
    photo: "/images/IMG_4015.jpg",
    Icon: Building2,
  },
  {
    id: "storage",
    title: "Storage Solutions",
    desc: "Climate-controlled storage for short or long-term needs.",
    photo: "/images/IMG_4525.jpg",
    Icon: Warehouse,
  },
];


export default function InfoHomePage() {
  return (
    <InfoLayout>
      {/* Green Discount Banner */}
      <div className="bg-primary text-white text-center text-xs md:text-sm font-extrabold py-2.5 tracking-widest uppercase">
        10% Discount for Seniors &amp; Veterans
      </div>

      {/* ═══ MAIN TWO-COLUMN SECTION ═══ */}
      <div className="flex flex-col lg:flex-row">

        {/* ══ LEFT: Hero (dark, full truck background) ══ */}
        <div className="lg:w-[58%] bg-secondary relative overflow-hidden" style={{ minHeight: 560 }}>

          {/* Truck photo — background sized to show full truck scene */}
          <div
            className="absolute inset-0 z-0 pointer-events-none select-none"
            style={{
              backgroundImage: "url('/images/teemer-truck.png')",
              backgroundSize: "100% auto",
              backgroundPosition: "center top",
              backgroundRepeat: "no-repeat",
              opacity: 0.82,
            }}
          />
          {/* Gradient overlays — separate div so they don't inherit opacity */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {/* Left-to-right: dark on text side, opens up on truck side */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(30,41,59,0.93) 0%, rgba(30,41,59,0.78) 30%, rgba(30,41,59,0.28) 56%, rgba(30,41,59,0.06) 100%)" }} />
            {/* Bottom vignette so truck doesn't hard-clip into page */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-secondary to-transparent" />
          </div>

          {/* Teemer logo overlaid on the truck cargo box */}
          <img
            src="/images/teemer-logo-full.jpg"
            alt="Teemer Moving & Storage Co. logo on truck"
            className="absolute pointer-events-none select-none"
            style={{
              zIndex: 5,
              right: "10%",
              top: "18%",
              width: "clamp(90px, 18%, 155px)",
              opacity: 0.90,
              borderRadius: "2px",
              mixBlendMode: "multiply",
            }}
          />

          {/* Text — left-aligned, truck visible on the right */}
          <div className="relative z-10 flex flex-col justify-center px-8 py-12 md:px-12 max-w-[52%]" style={{ minHeight: 560 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className="text-3xl md:text-4xl lg:text-[2.7rem] font-black text-white uppercase leading-tight mb-3">
                Make Moving<br />A Breeze
              </h1>
              <p className="text-primary font-bold text-sm md:text-base mb-2">
                Your Trusted Long Island &amp; NYC Moving Experts
              </p>
              <p className="text-slate-300 text-xs md:text-sm mb-6 leading-relaxed">
                Serving Long Beach, Nassau County, Suffolk County, Manhattan, Queens, and Brooklyn, NY.
                Licensed, Insured &amp; Award-Winning Service.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href="/info/quote"
                  className="bg-primary text-white px-6 py-3 rounded-full font-extrabold text-sm uppercase tracking-wide text-center hover:bg-primary/90 transition-colors shadow-lg"
                >
                  Get a Free Quote
                </Link>
                <a
                  href={`tel:${companyInfo.phone}`}
                  className="border-2 border-white/50 text-white px-6 py-3 rounded-full font-extrabold text-sm uppercase tracking-wide text-center hover:bg-white/10 transition-colors"
                >
                  Call Us: {companyInfo.phone}
                </a>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ══ RIGHT: Why Choose + Photo + Testimonials + Awards + Dark CTA ══ */}
        <div className="lg:w-[42%] flex flex-col bg-white border-l border-slate-100">

          {/* Why Choose Us */}
          <div className="p-5 md:p-6 border-b border-slate-100">
            <h2 className="font-black text-secondary text-sm uppercase tracking-wide leading-snug mb-4">
              The Teemer Moving & Storage Corp. Difference:<br />Why Choose Us?
            </h2>
            <ul className="space-y-2.5">
              {WHY_CHOOSE.map((item, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-slate-700 font-semibold text-xs md:text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Promise Photo */}
          <div className="relative h-36 md:h-44 overflow-hidden border-b border-slate-100">
            <img
              src="/images/IMG_4047.jpg"
              alt="Teemer crew"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-secondary/80 via-secondary/30 to-transparent flex items-end p-4">
              <p className="text-white font-bold text-sm italic leading-snug">
                Our promise is care in every step.
              </p>
            </div>
          </div>

          {/* Testimonials */}
          <div className="p-5 md:p-6 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-secondary text-xs uppercase tracking-widest">
                What Customers Say
              </h3>
              <div className="flex items-center gap-1">
                <Star className="fill-amber-400 text-amber-400 w-3 h-3" />
                <span className="text-[10px] font-bold text-amber-600">5.0</span>
                <span className="text-[9px] text-slate-400 ml-0.5">({testimonials.length} reviews)</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
              {testimonials.map((t, i) => (
                <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex flex-col">
                  <p className="text-[10px] font-bold text-secondary leading-tight mb-0.5">{t.name}</p>
                  <p className="text-[8px] text-slate-400 mb-1 leading-tight">{t.location}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed mb-2 line-clamp-3 flex-1">"{t.text}"</p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex text-amber-400">
                      {[...Array(t.rating)].map((_, idx) => (
                        <Star key={idx} className="fill-current w-2.5 h-2.5" />
                      ))}
                    </div>
                    {"source" in t && (
                      <span className="text-[8px] text-slate-400 font-medium">via {(t as {source: string}).source}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-[9px] text-slate-400 mt-2">Scroll to see all reviews</p>
          </div>

          {/* Awards */}
          <div className="p-5 md:p-6 border-b border-slate-100">
            <h3 className="font-black text-secondary text-xs uppercase tracking-widest text-center mb-5">
              An Award-Winning Team
            </h3>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {/* A+ Rating */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center shadow">
                  <span className="text-white font-black text-base">A+</span>
                </div>
                <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 text-center">Rating</span>
              </div>
              {/* NYSDOT */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-2 border-primary flex items-center justify-center">
                  <span className="text-primary font-black text-[9px] text-center leading-tight">NY<br/>SDOT</span>
                </div>
                <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 text-center">Licensed</span>
              </div>
              {/* Long Island Press Award — real photo */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full border-2 border-amber-400 overflow-hidden shadow">
                  <img src="/images/award-trophy.jpg" alt="Long Island Press Award" className="w-full h-full object-cover" />
                </div>
                <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 text-center">LI Press<br/>Award</span>
              </div>
              {/* Fully Insured */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-2 border-primary flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 text-center">Fully<br/>Insured</span>
              </div>
              {/* 5-Star Google */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-2 border-amber-400 bg-amber-50 flex flex-col items-center justify-center">
                  <Star className="fill-amber-400 text-amber-400 w-4 h-4" />
                  <span className="text-amber-700 font-black text-[9px]">5-Star</span>
                </div>
                <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 text-center">Google<br/>Rating</span>
              </div>
            </div>
          </div>

          {/* Dark CTA Block */}
          <div className="bg-secondary text-white p-6 md:p-8 text-center flex-1 flex flex-col items-center justify-center">
            <h3 className="font-black text-base md:text-lg uppercase leading-snug mb-4">
              Ready for a Stress-Free Move?<br />
              <span className="text-primary">Let Teemer Moving & Storage Corp. Take the Heavy Lifting.</span>
            </h3>
            <Link
              href="/info/quote"
              className="bg-primary text-white px-6 py-3 rounded-full font-extrabold text-sm uppercase tracking-wide hover:bg-primary/90 transition-colors shadow-lg mb-3"
            >
              Start Your Free Quote Now
            </Link>
            <p className="text-slate-400 text-xs">
              Or call us:{" "}
              <a href={`tel:${companyInfo.phone}`} className="text-white font-bold hover:underline">
                {companyInfo.phone}
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* ═══ SERVICES — Full width below both columns ═══ */}
      <section className="py-14 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-center text-xl md:text-2xl font-black text-secondary uppercase tracking-wide mb-10">
            Our Comprehensive Moving &amp; Storage Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SERVICE_CARDS.map((svc, i) => (
              <motion.div
                key={svc.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 hover:shadow-xl transition-shadow group"
              >
                {/* Photo with icon overlay */}
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={svc.photo}
                    alt={svc.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Icon badge */}
                  <div className="absolute top-3 left-3 w-9 h-9 bg-secondary/90 rounded-full flex items-center justify-center">
                    <svc.Icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                {/* Card Content */}
                <div className="p-5">
                  <h3 className="font-black text-secondary uppercase text-base mb-2">{svc.title}</h3>
                  <p className="text-slate-500 text-sm mb-4 leading-relaxed">{svc.desc}</p>
                  <Link
                    href="/info/services"
                    className="inline-flex items-center text-primary font-bold text-sm uppercase tracking-wide hover:underline"
                  >
                    Learn More <ArrowRight className="ml-1 w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </InfoLayout>
  );
}
