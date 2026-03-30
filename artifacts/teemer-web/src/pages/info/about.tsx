import { InfoLayout } from "@/components/layout/info-layout";
import { companyInfo } from "@/lib/mock-data";
import { Link } from "wouter";
import { GraduationCap, MapPin, Dumbbell, Heart } from "lucide-react";

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
                  <p className="text-slate-700 leading-relaxed text-base mb-8">
                    Driven by ambition and a passion for growth, Alan has developed a reputation for leadership and dedication in the moving and storage industry. He values discipline both professionally and personally, and is deeply family-oriented — grounding his work ethic and long-term vision in the importance of building a legacy for those closest to him.
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

          <div className="text-center mt-10">
            <Link href="/info/contact" className="text-primary font-bold hover:underline">Get in touch with our team &rarr;</Link>
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
