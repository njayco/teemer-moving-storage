import { InfoLayout } from "@/components/layout/info-layout";
import { faqs } from "@/lib/mock-data";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <InfoLayout>
      <div className="bg-white py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-secondary mb-12 text-center">Frequently Asked Questions</h1>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className={`border rounded-2xl overflow-hidden transition-all ${
                  openIndex === index ? "border-primary bg-primary/5" : "border-slate-200"
                }`}
              >
                <button 
                  className="w-full px-6 py-5 flex justify-between items-center text-left"
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                >
                  <span className="font-bold text-secondary pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-primary transition-transform ${openIndex === index ? "rotate-180" : ""}`} />
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-5 text-slate-600 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
