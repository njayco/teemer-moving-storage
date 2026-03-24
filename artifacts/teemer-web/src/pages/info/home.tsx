import { InfoLayout } from "@/components/layout/info-layout";
import { Link } from "wouter";
import { companyInfo, services, testimonials } from "@/lib/mock-data";
import { ArrowRight, Star, ShieldCheck, Clock, MapPin, Phone } from "lucide-react";
import { motion } from "framer-motion";

const CREW_STRIP_PHOTOS = [
  { src: "/images/IMG_1960.jpg", alt: "Teemer crew at work" },
  { src: "/images/IMG_4015.jpg", alt: "Teemer movers loading the truck" },
  { src: "/images/IMG_3913.jpg", alt: "Professional Teemer move in progress" },
  { src: "/images/IMG_4628.jpg", alt: "Teemer team ready for move day" },
];

export default function InfoHomePage() {
  return (
    <InfoLayout>
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden bg-slate-50">
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-20 pointer-events-none hidden lg:block">
          <img 
            src="/images/IMG_1914.jpg"
            alt="Teemer Moving crew in action" 
            className="w-full h-full object-cover"
            style={{ maskImage: "linear-gradient(to right, transparent, black 40%)" }}
          />
        </div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary font-bold mb-6 text-sm tracking-wide uppercase">
              <ShieldCheck className="w-4 h-4 mr-2" /> Top Rated Long Island Movers
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display text-secondary leading-tight mb-6">
              Make Moving a <br/><span className="text-primary">Breeze.</span>
            </h1>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-2xl">
              Work with a trusted residential and commercial moving company serving {companyInfo.serviceAreas.slice(0, 3).join(", ")}, and all of NYC.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-6">
              <Link 
                href="/info/quote" 
                className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-primary/20 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/30 transition-all text-center flex items-center justify-center"
              >
                Get a Free Quote <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <a 
                href={`tel:${companyInfo.phone}`}
                className="bg-white text-secondary border-2 border-slate-200 px-8 py-4 rounded-xl font-bold text-lg hover:border-primary hover:text-primary transition-all text-center flex items-center justify-center"
              >
                <Phone className="mr-2 w-5 h-5" /> Call {companyInfo.phone}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Highlight */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl font-bold font-display text-secondary mb-4">Comprehensive Moving Services</h2>
            <p className="text-slate-600 text-lg">We handle everything from standard apartment moves to complex commercial relocations.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.slice(0, 6).map((service, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                key={service.id} 
                className="bg-slate-50 border border-slate-100 p-8 rounded-3xl hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold text-secondary mb-3">{service.title}</h3>
                <p className="text-slate-600 mb-6 leading-relaxed">{service.shortDesc}</p>
                <Link href={`/info/services`} className="text-primary font-semibold flex items-center group-hover:underline">
                  Learn more <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Crew in Action Photo Strip */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-secondary mb-3">Our Crew in Action</h2>
            <p className="text-slate-500 text-lg">Real photos from real Teemer moves — no stock images, just our team doing what we do best.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CREW_STRIP_PHOTOS.map((photo, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative aspect-square rounded-2xl overflow-hidden group"
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-secondary/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/info/gallery"
              className="inline-flex items-center text-primary font-bold text-lg hover:underline"
            >
              See Full Gallery <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-secondary text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold font-display mb-6">Why Customers Hire Teemer</h2>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              We aren't just guys with a truck. We use modern logistics, trained personnel, and upfront pricing to ensure a stress-free experience from start to finish.
            </p>
            <ul className="space-y-6">
              {[
                "Years of industry experience",
                "Fully licensed & insured",
                "10% Senior & Veteran Discount",
                "Great customer service & communication",
                "Quick and efficient uniformed crews"
              ].map((point, i) => (
                <li key={i} className="flex items-start">
                  <div className="mt-1 bg-primary rounded-full p-1 mr-4">
                    <ShieldCheck className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-lg font-medium">{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-12">
              <Link href="/info/about" className="inline-block bg-white text-secondary px-8 py-4 rounded-xl font-bold hover:bg-primary hover:text-white transition-colors">
                Read Our Story
              </Link>
            </div>
          </div>
          <div className="relative h-[500px] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <img 
              src="/images/IMG_4047.jpg"
              alt="Teemer Moving crew at work" 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
              <p className="text-2xl font-bold font-display italic">"Teamwork is the Key to Success"</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-display text-secondary mb-4">What Our Clients Say</h2>
            <div className="flex justify-center text-amber-400 space-x-1 mb-4">
              {[1,2,3,4,5].map(i => <Star key={i} className="fill-current w-6 h-6" />)}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative">
                <div className="text-6xl text-slate-100 font-serif absolute top-4 right-6">"</div>
                <div className="flex text-amber-400 mb-4">
                  {[...Array(t.rating)].map((_, idx) => <Star key={idx} className="fill-current w-4 h-4" />)}
                </div>
                <p className="text-slate-600 mb-6 italic relative z-10">"{t.text}"</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold mr-3">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-secondary">{t.name}</p>
                    <p className="text-sm text-slate-500">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Strip */}
      <section className="bg-primary py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-white mb-6">Ready for a stress-free move?</h2>
          <p className="text-primary-foreground/80 text-lg mb-8">Get your free, no-obligation quote today and see how easy moving can be.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/info/quote" className="bg-white text-primary px-8 py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-shadow">
              Request a Quote
            </Link>
            <a href={`tel:${companyInfo.phone}`} className="bg-primary-foreground/10 border border-primary-foreground/20 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary-foreground/20 transition-colors">
              Call Now
            </a>
          </div>
        </div>
      </section>
    </InfoLayout>
  );
}
