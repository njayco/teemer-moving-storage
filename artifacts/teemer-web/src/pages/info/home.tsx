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

function TeemerTruckSVG() {
  return (
    <svg viewBox="0 0 520 170" className="w-full" style={{ opacity: 0.38 }} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* ── Cargo box ── */}
      <rect x="10" y="18" width="330" height="122" rx="5" fill="white" fillOpacity="0.08" stroke="white" strokeWidth="2" />
      {/* Cargo door vertical lines */}
      {[60,110,160,210,260,310].map(x => (
        <line key={x} x1={x} y1="18" x2={x} y2="140" stroke="white" strokeOpacity="0.15" strokeWidth="1" />
      ))}
      {/* Rear bumper lip */}
      <rect x="10" y="138" width="330" height="8" rx="2" fill="white" fillOpacity="0.15" />
      {/* TEEMER text on cargo box */}
      <text x="34" y="80" fontSize="30" fontWeight="800" fill="white" fillOpacity="0.6" letterSpacing="6" fontFamily="sans-serif">TEEMER</text>
      <text x="34" y="102" fontSize="11" fill="white" fillOpacity="0.4" letterSpacing="2" fontFamily="sans-serif">MOVING &amp; STORAGE CO.</text>

      {/* ── Cab ── */}
      <path d="M340 52 L340 140 L496 140 L496 90 Q496 52 462 52 Z" fill="white" fillOpacity="0.08" stroke="white" strokeWidth="2" />
      {/* Windshield */}
      <path d="M346 58 L346 96 L488 96 L488 80 Q472 58 450 58 Z" fill="white" fillOpacity="0.12" stroke="white" strokeWidth="1" />
      {/* Side window */}
      <rect x="346" y="100" width="60" height="30" rx="2" fill="white" fillOpacity="0.08" stroke="white" strokeWidth="0.8" />
      {/* Door handle */}
      <rect x="360" y="118" width="18" height="4" rx="2" fill="white" fillOpacity="0.4" />
      {/* Front bumper/grill */}
      <rect x="482" y="112" width="14" height="28" rx="2" fill="white" fillOpacity="0.12" stroke="white" strokeWidth="1" />
      {/* Headlight */}
      <circle cx="492" cy="108" r="5" fill="white" fillOpacity="0.5" />
      {/* Exhaust stack */}
      <rect x="474" y="10" width="6" height="45" rx="3" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1" />

      {/* ── Wheels ── */}
      {/* Rear dual wheels */}
      <circle cx="82" cy="155" r="18" fill="white" fillOpacity="0.06" stroke="white" strokeWidth="2" />
      <circle cx="82" cy="155" r="8" fill="white" fillOpacity="0.15" />
      <circle cx="120" cy="155" r="18" fill="white" fillOpacity="0.06" stroke="white" strokeWidth="2" />
      <circle cx="120" cy="155" r="8" fill="white" fillOpacity="0.15" />
      {/* Front wheel */}
      <circle cx="440" cy="155" r="18" fill="white" fillOpacity="0.06" stroke="white" strokeWidth="2" />
      <circle cx="440" cy="155" r="8" fill="white" fillOpacity="0.15" />

      {/* ── Ground shadow line ── */}
      <line x1="10" y1="168" x2="510" y2="168" stroke="white" strokeOpacity="0.1" strokeWidth="1.5" />
    </svg>
  );
}

function LongIslandSilhouette() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-3">
      <svg viewBox="0 0 300 110" className="w-full max-w-[280px]" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* ── Long Island main body ── */}
        {/* North shore (top edge) runs left-right */}
        {/* South shore (bottom edge) runs left-right, straighter */}
        <path
          d="
            M18,52
            Q20,44 28,40 Q36,36 48,34 Q60,32 74,30
            Q90,28 108,28 Q126,27 144,28
            Q162,29 178,30 Q194,31 208,32
            Q222,33 234,35 Q244,37 250,40
            Q256,42 258,46
            Q262,42 266,38 Q270,34 272,32
            Q276,30 280,32 Q284,34 282,40
            Q280,44 276,48 Q272,52 268,54
            Q260,60 252,62
            Q244,64 232,64 Q216,65 200,64
            Q184,63 168,62 Q152,61 136,62
            Q120,63 106,65 Q92,67 80,68
            Q64,70 50,68 Q36,66 26,60
            Q18,56 18,52 Z
          "
          fill="white"
          fillOpacity="0.15"
          stroke="white"
          strokeWidth="1.5"
          strokeOpacity="0.7"
        />
        {/* North Fork (upper eastern fork) */}
        <path
          d="M258,46 Q262,42 266,38 Q270,34 272,32 Q276,30 280,32 Q284,34 282,40 Q280,44 276,48 Q272,52 268,54 Q263,56 258,56"
          fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.2" strokeOpacity="0.6"
        />
        {/* South Fork (lower eastern fork - Hamptons) */}
        <path
          d="M252,62 Q256,64 260,66 Q264,68 266,72 Q268,76 265,80 Q262,83 258,82 Q254,81 250,78 Q246,74 248,70 Q250,66 252,62"
          fill="white" fillOpacity="0.12" stroke="white" strokeWidth="1.2" strokeOpacity="0.6"
        />
        {/* NYC boroughs box (left side) */}
        <rect x="2" y="44" width="18" height="20" rx="2" fill="white" fillOpacity="0.12" stroke="white" strokeWidth="1" strokeOpacity="0.5" />

        {/* ── Service area dots and labels ── */}
        {/* NYC */}
        <circle cx="11" cy="54" r="3.5" fill="#22c55e" />
        <text x="22" y="51" fontSize="6.5" fill="white" fontFamily="sans-serif" fontWeight="700">NYC</text>

        {/* Long Beach */}
        <circle cx="78" cy="60" r="3" fill="#22c55e" />
        <text x="66" y="74" fontSize="5.5" fill="white" fontFamily="sans-serif" fontWeight="600">Long Beach</text>

        {/* Nassau */}
        <circle cx="110" cy="46" r="3" fill="#22c55e" />
        <text x="98" y="40" fontSize="6" fill="white" fontFamily="sans-serif" fontWeight="600">Nassau</text>

        {/* Suffolk */}
        <circle cx="196" cy="45" r="3" fill="#22c55e" />
        <text x="182" y="39" fontSize="6" fill="white" fontFamily="sans-serif" fontWeight="600">Suffolk</text>

        {/* Dot connectors */}
        <line x1="11" y1="54" x2="78" y2="60" stroke="white" strokeOpacity="0.2" strokeWidth="0.8" strokeDasharray="3 3" />
        <line x1="78" y1="60" x2="110" y2="46" stroke="white" strokeOpacity="0.2" strokeWidth="0.8" strokeDasharray="3 3" />
        <line x1="110" y1="46" x2="196" y2="45" stroke="white" strokeOpacity="0.2" strokeWidth="0.8" strokeDasharray="3 3" />
      </svg>
      <p className="text-white/50 text-[8px] text-center font-bold tracking-widest uppercase mt-1">
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
        <div className="lg:w-[58%] bg-secondary relative overflow-hidden" style={{ minHeight: 560 }}>
          <div className="flex" style={{ minHeight: 560 }}>

            {/* Left side of hero — text + truck watermark */}
            <div className="w-[52%] flex flex-col justify-center px-7 py-10 md:px-10 relative">
              {/* Truck SVG watermark — sits behind text content */}
              <div className="absolute bottom-0 left-0 right-0 z-0 pointer-events-none select-none">
                <TeemerTruckSVG />
              </div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10">
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

            {/* Right side of hero — photo collage + Long Island map */}
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
                  <LongIslandSilhouette />
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
              The Teemer Moving & Storage Difference:<br />Why Choose Us?
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
              <span className="text-primary">Let Teemer Moving & Storage Take the Heavy Lifting.</span>
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
