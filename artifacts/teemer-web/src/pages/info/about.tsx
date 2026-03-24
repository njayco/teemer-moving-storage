import { InfoLayout } from "@/components/layout/info-layout";
import { companyInfo } from "@/lib/mock-data";
import { Link } from "wouter";

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
          <div className="text-center mt-12">
            <Link href="/info/contact" className="text-primary font-bold hover:underline">Get in touch with our team &rarr;</Link>
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
