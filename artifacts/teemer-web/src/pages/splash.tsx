import { Link } from "wouter";
import { ArrowRight, Truck, PhoneCall, ShieldCheck, Map, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

export default function SplashPage() {
  return (
    <div className="min-h-screen bg-secondary relative overflow-hidden font-sans flex flex-col">
      {/* Background Image & Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/splash-bg.png`} 
          alt="Teemer Platform Network" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/80 to-transparent" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-10 flex justify-between items-center">
        <div className="flex items-center">
          <img 
            src={`${import.meta.env.BASE_URL}teemer-logo.jpg`} 
            alt="Teemer Logo" 
            className="h-12 w-auto object-contain rounded bg-white p-1 shadow-lg"
          />
          <span className="ml-4 text-2xl md:text-3xl font-bold font-display text-white tracking-tight">Teemer Moving & Storage Corp.</span>
        </div>
        <div className="hidden sm:flex bg-primary/20 border border-primary/50 text-white px-4 py-2 rounded-full text-sm font-medium items-center backdrop-blur-sm">
          <ShieldCheck className="w-4 h-4 mr-2 text-primary" />
          Trusted Long Island & NYC Movers
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 max-w-7xl mx-auto w-full py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mb-16"
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display text-white mb-6 leading-tight">
            Make Moving a <span className="text-primary text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">Breeze</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
            A smarter way to book, manage, and fulfill moving jobs across Long Beach, Nassau, Suffolk, and NYC boroughs.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
          {/* Info Site Portal Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Link 
              href="/info"
              className="block h-full group relative bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl hover:bg-white/10 hover:border-primary/50 transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity" />
              <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6 text-white group-hover:scale-110 group-hover:bg-primary transition-all">
                <Map className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4 font-display">Learn About Teemer Moving & Storage Corp.</h2>
              <p className="text-slate-400 mb-8 text-lg">
                View our services, coverage areas, pricing structure, and company history. Get a free estimate for your next move.
              </p>
              <div className="flex items-center text-primary font-bold text-lg group-hover:translate-x-2 transition-transform">
                Enter Information Site <ArrowRight className="ml-2 w-5 h-5" />
              </div>
            </Link>
          </motion.div>

          {/* Platform Portal Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link 
              href="/platform/customer"
              className="block h-full group relative bg-gradient-to-br from-primary/90 to-green-700 p-8 rounded-3xl hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute top-0 right-0 -mr-8 -mt-8 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-6 text-white group-hover:scale-110 transition-transform">
                <Truck className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4 font-display">Access Platform</h2>
              <p className="text-green-50 mb-8 text-lg">
                Book a move directly, track your truck in real-time, or access the provider marketplace to find moving jobs.
              </p>
              <div className="flex items-center text-white font-bold text-lg group-hover:translate-x-2 transition-transform bg-black/20 w-max px-6 py-3 rounded-full">
                Enter Platform <ArrowRight className="ml-2 w-5 h-5" />
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Feature Row */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-20 w-full max-w-5xl border-t border-white/10 pt-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
        >
          {[
            { icon: PhoneCall, label: "App-based Booking" },
            { icon: CreditCard, label: "Instant Upfront Pricing" },
            { icon: Map, label: "Real-Time Tracking" },
            { icon: ShieldCheck, label: "Smart Dispatch System" }
          ].map((feat, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 text-slate-300">
                <feat.icon className="w-5 h-5" />
              </div>
              <span className="text-slate-400 font-medium text-sm">{feat.label}</span>
            </div>
          ))}
        </motion.div>
      </main>
      
      {/* Footer link for Admin */}
      <div className="absolute bottom-6 right-6 z-20">
        <Link href="/admin" className="text-slate-500 hover:text-slate-300 text-sm font-medium">
          Admin Login
        </Link>
      </div>
    </div>
  );
}
