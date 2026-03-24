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
    photo: "/images/IMG_2975.jpg",
    Icon: Warehouse,
  },
];

function ServiceAreaMap() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 text-white/80">
      <svg viewBox="0 0 160 90" className="w-full max-w-[140px] opacity-70" fill="none">
        {/* Rough outline of Long Island */}
        <path
          d="M10 55 Q30 45 50 40 Q70 35 95 38 Q115 40 135 45 Q148 48 152 52 Q148 58 130 60 Q100 65 70 62 Q45 60 25 62 Z"
          stroke="white" strokeWidth="1.2" fill="white" fillOpacity="0.1"
        />
        {/* NYC area */}
        <rect x="6" y="44" width="8" height="10" rx="1" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.15" />
        {/* Service area dots */}
        <circle cx="15" cy="49" r="2.5" fill="#22c55e" />
        <text x="18" y="52" fontSize="5" fill="white">NYC</text>
        <circle cx="45" cy="50" r="2" fill="#22c55e" />
        <text x="48" y="53" fontSize="4.5" fill="white">Nassau</text>
        <circle cx="100" cy="48" r="2" fill="#22c55e" />
        <text x="88" y="43" fontSize="4.5" fill="white">Suffolk</text>
        {/* Long Beach */}
        <circle cx="55" cy="60" r="1.8" fill="#22c55e" />
        <text x="42" y="70" fontSize="4.5" fill="white">Long Beach</text>
      </svg>
      <p className="text-white/60 text-[9px] text-center mt-1 font-medium tracking-wide">
        Serving LI &amp; All NYC Boroughs
      </p>
    </div>
  );
}

export default function InfoHomePage() {
  return (
    <InfoLayout>
      {/* Green Discount Banner */}
      <div className="bg-primary text-white text-center text-xs md:text-sm font-extrabold py-2.5 tracking-widest uppercase">
        10% Discount for Seniors &amp; Veterans
      </div>

      {/* ═══ MAIN TWO-COLUMN SECTION ═══ */}
      <div className="flex flex-col lg:flex-row">

        {/* ══ LEFT: Hero (dark, ~58%) ══ */}
        <div className="lg:w-[58%] bg-secondary relative overflow-hidden min-h-[540px]">
          <div className="flex h-full">

            {/* Left side of hero — text */}
            <div className="w-[52%] relative z-10 flex flex-col justify-center px-7 py-10 md:px-10">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <h1 className="text-3xl md:text-4xl lg:text-[2.6rem] font-black text-white uppercase leading-tight mb-2">
                  Make Moving<br />A Breeze
                </h1>
                <p className="text-primary font-bold text-sm md:text-base mb-2">
                  Your Trusted Long Island &amp; NYC Moving Experts
                </p>
                <p className="text-slate-300 text-xs md:text-sm mb-5 leading-relaxed">
                  Serving Long Beach, Nassau County, Suffolk County, Manhattan, Queens, and Brooklyn, NY.
                  Licensed, Insured &amp; Award-Winning Service.
                </p>
                <div className="flex flex-col gap-2">
                  <Link
                    href="/info/quote"
                    className="bg-primary text-white px-5 py-2.5 rounded-full font-extrabold text-xs md:text-sm uppercase tracking-wide text-center hover:bg-primary/90 transition-colors shadow-lg"
                  >
                    Get a Free Quote
                  </Link>
                  <a
                    href={`tel:${companyInfo.phone}`}
                    className="border-2 border-white/50 text-white px-5 py-2.5 rounded-full font-extrabold text-xs md:text-sm uppercase tracking-wide text-center hover:bg-white/10 transition-colors"
                  >
                    Call Us: {companyInfo.phone}
                  </a>
                </div>
              </motion.div>
            </div>

            {/* Right side of hero — photo collage */}
            <div className="flex-1 relative">
              {/* Top photo */}
              <div className="absolute top-0 left-0 right-0 h-[58%] overflow-hidden">
                <img
                  src="/images/IMG_1960.jpg"
                  alt="Teemer crew at work"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-secondary/40 to-transparent" />
              </div>
              {/* Bottom row: second photo + map */}
              <div className="absolute bottom-0 left-0 right-0 h-[41%] flex gap-0.5">
                <div className="flex-1 overflow-hidden relative">
                  <img
                    src="/images/IMG_1914.jpg"
                    alt="Teemer movers"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-secondary/20" />
                </div>
                <div className="flex-1 bg-secondary/90 border-l border-white/10">
                  <ServiceAreaMap />
                </div>
              </div>
              {/* Left fade into text */}
              <div className="absolute top-0 left-0 bottom-0 w-10 bg-gradient-to-r from-secondary to-transparent pointer-events-none" />
            </div>
          </div>
        </div>

        {/* ══ RIGHT: Why Choose + Photo + Testimonials + Awards + Dark CTA ══ */}
        <div className="lg:w-[42%] flex flex-col bg-white border-l border-slate-100">

          {/* Why Choose Us */}
          <div className="p-5 md:p-6 border-b border-slate-100">
            <h2 className="font-black text-secondary text-sm uppercase tracking-wide leading-snug mb-4">
              The Teemer Difference:<br />Why Choose Us?
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
            <h3 className="font-black text-secondary text-xs uppercase tracking-widest text-center mb-4">
              Hear From Our Satisfied Customers
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {testimonials.slice(0, 3).map((t, i) => (
                <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight mb-1">{t.location}:</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed mb-2 line-clamp-3">"{t.text}"</p>
                  <div className="flex text-amber-400">
                    {[...Array(t.rating)].map((_, idx) => (
                      <Star key={idx} className="fill-current w-2.5 h-2.5" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
              {/* Long Island Choice Awards */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full border-2 border-amber-400 bg-amber-50 flex flex-col items-center justify-center px-1 shadow">
                  <span className="text-[8px] font-black text-amber-800 text-center leading-tight">LONG<br/>ISLAND<br/>CHOICE<br/>AWARDS</span>
                </div>
                <span className="text-[9px] font-bold text-slate-500 uppercase mt-1 text-center">Winner</span>
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
              <span className="text-primary">Let Teemer Take the Heavy Lifting.</span>
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
