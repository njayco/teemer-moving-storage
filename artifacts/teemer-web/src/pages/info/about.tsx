import { InfoLayout } from "@/components/layout/info-layout";
import { companyInfo } from "@/lib/mock-data";
import { Link } from "wouter";
import { GraduationCap, MapPin, Dumbbell, Heart, Award, Cpu, Lightbulb, Users } from "lucide-react";

const AWARD_IMAGES = [
  {
    src: `${import.meta.env.BASE_URL}images/IMG_2975.jpg`,
    alt: "Teemer Moving & Storage Corp. Long Island Choice Awards 2025 - Best Moving Services",
  },
  {
    src: `${import.meta.env.BASE_URL}images/ChatGPT_Image_Apr_19,_2026_at_06_05_39_PM_1776636954805.png`,
    alt: "2026 MLK Day Long Beach Community Leadership and Entrepreneurship Award presented to Alan Teemer",
  },
  {
    src: `${import.meta.env.BASE_URL}images/mlk_award_2026_real.jpg`,
    alt: "2026 MLK Day Long Beach Community Leadership & Entrepreneurship Award certificate presented to Alan Teemer — January 19th, 2026",
  },
];

export default function AboutPage() {
  return (
    <InfoLayout>
      <div className="bg-slate-50 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-secondary mb-8 text-center">About {companyInfo.name}</h1>

          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100">
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              {companyInfo.description}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 pt-12 border-t border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-secondary mb-4">Our Mission</h3>
                <p className="text-slate-600">To provide efficient, safe, and entirely transparent moving services that turn a stressful day into a breeze.</p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-secondary mb-4">Our Values</h3>
                <ul className="list-disc list-inside text-slate-600 space-y-2 ml-4">
                  <li>Integrity and upfront pricing</li>
                  <li>Care for customer belongings</li>
                  <li>Punctuality and reliability</li>
                  <li>Community focus</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Crew in action banner */}
          <div className="mt-10 rounded-3xl overflow-hidden shadow-md border border-slate-100 h-72 md:h-96">
            <img
              src={`${import.meta.env.BASE_URL}images/IMG_4628.jpg`}
              alt="Teemer Moving crew carefully handling specialty items on the job"
              className="w-full h-full object-cover object-center"
            />
          </div>

          {/* Award recognition */}
          <div className="mt-10 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="flex flex-col justify-center p-8 md:p-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-primary font-bold text-sm uppercase tracking-widest">Recognition</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-secondary mb-4">Award-Winning Service</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Proud winner of the <strong>Long Island Choice Awards 2025</strong> — Best Moving Services, presented by the Herald and PSEG Long Island. This recognition reflects our commitment to exceptional service and community trust.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  We are also honored to receive the <strong>2026 MLK Day Long Beach Community Leadership &amp; Entrepreneurship Award</strong> in recognition of outstanding entrepreneurship, community investment, and steadfast leadership.
                </p>
              </div>
              <div className="relative h-64 md:h-auto overflow-hidden">
                {AWARD_IMAGES.map((img, i) => (
                  <div
                    key={img.src}
                    className="absolute inset-0"
                    style={{
                      animation: `awardSlide 12s ease-in-out infinite`,
                      animationDelay: `${i * 4}s`,
                      opacity: i === 0 ? undefined : 0,
                    }}
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CEO Bio Section */}
          <div className="mt-10 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-secondary to-secondary/80 px-8 py-5">
              <p className="text-primary font-bold text-sm uppercase tracking-widest">Leadership</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">Meet Our CEO</h2>
            </div>

            <div className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-10 items-start">
                {/* Photo */}
                <div className="flex-shrink-0 mx-auto md:mx-0">
                  <div className="relative">
                    <div className="w-52 h-64 md:w-56 md:h-72 rounded-2xl overflow-hidden shadow-lg border-4 border-primary/20">
                      <img
                        src={`${import.meta.env.BASE_URL}alan-teemer.jpeg`}
                        alt="Alan Teemer, CEO of Teemer Moving & Storage Corp."
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="absolute -bottom-3 -right-3 bg-primary text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                      CEO
                    </div>
                  </div>
                  <div className="text-center mt-6">
                    <p className="font-bold text-secondary text-lg">Alan Teemer</p>
                    <p className="text-slate-500 text-sm">Chief Executive Officer</p>
                    <p className="text-slate-400 text-xs mt-1">Teemer Moving & Storage Corp.</p>
                  </div>
                </div>

                {/* Bio */}
                <div className="flex-1">
                  <p className="text-slate-700 leading-relaxed text-base mb-6">
                    Alan Teemer is the CEO of Teemer Moving and Storage Corp., where he leads with a strong commitment to reliability, efficiency, and customer satisfaction. Originally from Long Beach, Alan built his foundation in business through his studies at Nassau Community College and Alfred University, where he majored in Business.
                  </p>
                  <p className="text-slate-700 leading-relaxed text-base mb-6">
                    Driven by ambition and a passion for growth, Alan has developed a reputation for leadership and dedication in the moving and storage industry. He values discipline both professionally and personally, and is deeply family-oriented — grounding his work ethic and long-term vision in the importance of building a legacy for those closest to him.
                  </p>
                  <p className="text-slate-700 leading-relaxed text-base mb-8">
                    As Teemer Moving continues to grow, Alan has become a respected figure in the moving and storage industry, known for his community focus, hands-on leadership, and commitment to raising the standard of service for customers across Long Island and New York City.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Hometown</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">Long Beach, NY</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <GraduationCap className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Education</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">Nassau CC · Alfred University</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Dumbbell className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Interests</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">Fitness & Leadership</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Heart className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Driven By</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">Family & Legacy</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTO Bio Section */}
          <div className="mt-10 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary/80 px-8 py-5">
              <p className="text-white/70 font-bold text-sm uppercase tracking-widest">Leadership</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">Meet Our CTO</h2>
            </div>

            <div className="p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-10 items-start">
                {/* Photo */}
                <div className="flex-shrink-0 mx-auto md:mx-0">
                  <div className="relative">
                    <div className="w-52 h-64 md:w-56 md:h-72 rounded-2xl overflow-hidden shadow-lg border-4 border-primary/20">
                      <img
                        src={`${import.meta.env.BASE_URL}najee-jeremiah.jpg`}
                        alt="Najee Jeremiah, CTO of Teemer Moving & Storage Corp."
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="absolute -bottom-3 -right-3 bg-secondary text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                      CTO
                    </div>
                  </div>
                  <div className="text-center mt-6">
                    <p className="font-bold text-secondary text-lg">Najee Jeremiah</p>
                    <p className="text-slate-500 text-sm">Chief Technology Officer</p>
                    <p className="text-slate-400 text-xs mt-1">Teemer Moving & Storage Corp.</p>
                  </div>
                </div>

                {/* Bio */}
                <div className="flex-1">
                  <p className="text-slate-700 leading-relaxed text-base mb-4">
                    Najee Khaleel Jeremiah is a Systems Architect and AI-native Software Engineer serving as Chief Technology Officer of Teemer Moving Company. With a foundation in Electrical Engineering from Howard University, Nassau Community College, and Brooklyn College, Najee blends technical depth with real-world execution.
                  </p>
                  <p className="text-slate-700 leading-relaxed text-base mb-4">
                    He further advanced his expertise through the Pursuit HQ bootcamp in Long Island City, where he was trained in modern full-stack development, cloud systems, and AI-driven product design. His work focuses on building scalable, intelligent platforms — from logistics and dispatch systems to real-time tracking applications — bringing innovation and automation to industries traditionally underserved by technology.
                  </p>
                  <p className="text-slate-700 leading-relaxed text-base mb-8">
                    Beyond Teemer, Najee is a visionary entrepreneur and founder of multiple ventures — including YsUp (educational gamification platform), Phone Msgr (social messaging app), and NJAYCO, a multi-industry holding company. Through the Denoko Cooperative he develops community-driven tools that empower small businesses with enterprise-level technology. Driven by his own journey, Najee is deeply committed to helping young Black men succeed and build the future.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <GraduationCap className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Education</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">Howard U · Brooklyn College · Pursuit HQ</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Cpu className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Specialty</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">AI Systems & Scalable Platforms</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Lightbulb className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Ventures</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">YsUp · Phone Msgr · NJAYCO</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Mission</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5">Empowering Young Black Men</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Photo grid — crew at work */}
          <div className="mt-10 grid grid-cols-3 gap-4">
            <div className="rounded-2xl overflow-hidden h-48 shadow-sm border border-slate-100">
              <img
                src={`${import.meta.env.BASE_URL}images/IMG_3913.jpg`}
                alt="Teemer crew preparing a residential move with boxes"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="rounded-2xl overflow-hidden h-48 shadow-sm border border-slate-100">
              <img
                src={`${import.meta.env.BASE_URL}images/IMG_4525.jpg`}
                alt="Teemer crew wrapping and protecting furniture"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="rounded-2xl overflow-hidden h-48 shadow-sm border border-slate-100">
              <img
                src={`${import.meta.env.BASE_URL}images/IMG_4015.jpg`}
                alt="Teemer crew reassembling furniture at destination"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Customer Video Testimonial */}
          <div className="mt-10 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-secondary to-secondary/80 px-8 py-5">
              <p className="text-primary font-bold text-sm uppercase tracking-widest">From Our Customers</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">Hear What They're Saying</h2>
            </div>
            <div className="p-8 flex flex-col md:flex-row gap-8 items-center">
              <div className="w-full md:w-1/2 rounded-2xl overflow-hidden shadow-md border border-slate-100 bg-secondary">
                <video
                  src={`${import.meta.env.BASE_URL}videos/testimonial-4.mov`}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full"
                  style={{ background: "#0B132B" }}
                >
                  Your browser does not support video playback.
                </video>
              </div>
              <div className="w-full md:w-1/2">
                <div className="flex text-amber-400 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-700 text-lg leading-relaxed mb-4 italic">
                  "Real stories from real customers — see why Long Island &amp; NYC families trust Teemer Moving &amp; Storage Corp. with their most important day."
                </p>
                <p className="text-slate-500 text-sm">
                  We take pride in every move we complete. Our customers' peace of mind is the measure of our success.
                </p>
                <div className="mt-6">
                  <Link
                    href="/info/quote"
                    className="inline-flex items-center bg-primary text-white px-6 py-3 rounded-full font-bold shadow-md hover:bg-primary/90 transition-colors"
                  >
                    Book Your Move
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link href="/info/contact" className="text-primary font-bold hover:underline">Get in touch with our team &rarr;</Link>
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
