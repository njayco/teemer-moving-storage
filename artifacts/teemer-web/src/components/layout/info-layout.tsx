import { Link, useLocation } from "wouter";
import { companyInfo } from "@/lib/mock-data";
import { Phone, MapPin, Clock, Menu, X, ArrowRight } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function InfoLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/info", label: "Home" },
    { href: "/info/about", label: "About" },
    { href: "/info/services", label: "Services" },
    { href: "/info/service-area", label: "Service Area" },
    { href: "/info/gallery", label: "Gallery" },
    { href: "/info/faq", label: "FAQ" },
    { href: "/info/contact", label: "Contact" },
    { href: "/track", label: "Check Moving Job Status" },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Top Bar */}
      <div className="bg-secondary text-white py-2 px-4 text-sm hidden md:block">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-6 text-slate-300">
            <span className="flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-primary" />
              {companyInfo.location}
            </span>
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-2 text-primary" />
              Mon-Fri 7AM-6PM
            </span>
          </div>
          <div className="flex items-center font-semibold text-primary">
            <span className="text-white mr-2">10% Discount for Seniors & Veterans</span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center group">
            <img 
              src={`${import.meta.env.BASE_URL}teemer-logo.jpg`} 
              alt="Teemer Logo" 
              className="h-12 w-auto object-contain rounded-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="ml-3 text-xl font-bold font-display tracking-tight text-secondary group-hover:text-primary transition-colors">
              Teemer Moving & Storage Corp.
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href}
                className={`font-medium transition-colors hover:text-primary ${
                  location === link.href ? "text-primary" : "text-slate-600"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center space-x-4">
            <div className="flex flex-col items-end mr-4">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Call for an Estimate</span>
              <a href={`tel:${companyInfo.phone}`} className="flex items-center text-secondary font-bold text-lg hover:text-primary transition-colors">
                <Phone className="w-4 h-4 mr-2 text-primary fill-primary" />
                {companyInfo.phone}
              </a>
            </div>
            <Link 
              href="/info/quote" 
              className="bg-primary text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-primary/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 transition-all duration-200"
            >
              Get a Quote
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 text-secondary"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-border overflow-hidden"
          >
            <nav className="flex flex-col px-4 py-4 space-y-4">
              {navLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`font-medium text-lg pb-2 border-b border-slate-100 ${
                    location === link.href ? "text-primary" : "text-slate-600"
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 flex flex-col space-y-4">
                <a href={`tel:${companyInfo.phone}`} className="flex items-center justify-center bg-slate-100 text-secondary py-3 rounded-xl font-bold">
                  <Phone className="w-5 h-5 mr-2 text-primary" />
                  Call {companyInfo.phone}
                </a>
                <Link 
                  href="/info/quote" 
                  className="flex items-center justify-center bg-primary text-white py-3 rounded-xl font-bold"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Get a Free Quote <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-secondary text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <div className="flex items-center mb-6">
              <span className="text-xl font-bold font-display text-white">Teemer Moving & Storage Corp.</span>
            </div>
            <p className="mb-6">{companyInfo.tagline}</p>
            <div className="space-y-3">
              <p className="flex items-center"><MapPin className="w-5 h-5 mr-3 text-primary shrink-0" /> {companyInfo.location}</p>
              <p className="flex items-center"><Phone className="w-5 h-5 mr-3 text-primary shrink-0" /> {companyInfo.phone}</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-bold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-3">
              {navLinks.slice(1, 6).map(link => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-primary transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-6">Service Areas</h3>
            <ul className="space-y-3">
              {companyInfo.serviceAreas.map(area => (
                <li key={area} className="flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mr-2" />
                  {area}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-lg mb-6">Business Hours</h3>
            <ul className="space-y-3">
              <li className="flex justify-between border-b border-slate-700 pb-2">
                <span>Mon - Fri</span>
                <span className="text-white">7:00 AM - 6:00 PM</span>
              </li>
              <li className="flex justify-between border-b border-slate-700 pb-2">
                <span>Sat - Sun</span>
                <span className="text-white">By Appointment</span>
              </li>
            </ul>
            <div className="mt-6 p-4 bg-slate-800 rounded-xl border border-slate-700">
              <p className="text-primary font-bold text-sm uppercase tracking-wider mb-1">Special Offer</p>
              <p className="text-white text-sm">10% Discount for Seniors & Veterans</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-16 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Teemer Moving & Storage Corp. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
