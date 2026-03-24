import { InfoLayout } from "@/components/layout/info-layout";

const MOCK_IMAGES = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1595853035070-59a39fe84da3?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1603712725038-e9334ae8f39f?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop"
];

export default function GalleryPage() {
  return (
    <InfoLayout>
      <div className="bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-secondary mb-6">Our Work in Action</h1>
          <p className="text-lg text-slate-600 mb-16 max-w-2xl mx-auto">
            A glimpse into how our professional crews handle residential, commercial, and specialty moves.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MOCK_IMAGES.map((src, idx) => (
              <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden group">
                <img 
                  src={src} 
                  alt={`Teemer Moving Action ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-secondary/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <span className="text-white font-bold tracking-wide">View Image</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </InfoLayout>
  );
}
