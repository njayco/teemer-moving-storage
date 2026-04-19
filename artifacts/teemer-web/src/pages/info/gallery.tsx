import { InfoLayout } from "@/components/layout/info-layout";

const TEEMER_PHOTOS = [
  { src: "/images/IMG_1914.jpg", alt: "Teemer crew carefully loading furniture into the truck" },
  { src: "/images/IMG_1918.jpg", alt: "Teemer movers wrapping and protecting items for transport" },
  { src: "/images/IMG_1923.jpg", alt: "Professional Teemer crew working a residential move" },
  { src: "/images/IMG_1927.jpg", alt: "Teemer team securing boxes in the moving truck" },
  { src: "/images/IMG_1960.jpg", alt: "Teemer movers carrying furniture through a doorway" },
  { src: "/images/IMG_1970.jpg", alt: "Teemer crew unloading and organizing belongings" },
  { src: "/images/IMG_2975.jpg", alt: "Teemer professionals handling a Long Island move" },
  { src: "/images/award-trophy.jpg", alt: "Long Island Press Award trophy" },
  { src: "/images/award_for_teemer_1776637916733.jpg", alt: "2026 MLK Day Long Beach Community Leadership and Entrepreneurship Award presented to Alan Teemer" },
  { src: "/images/IMG_3913.jpg", alt: "Teemer team completing a full home relocation" },
  { src: "/images/IMG_4015.jpg", alt: "Teemer movers stacking and loading boxes with care" },
  { src: "/images/IMG_4047.jpg", alt: "Teemer crew performing a commercial office move" },
  { src: "/images/IMG_4525.jpg", alt: "Teemer uniformed movers on a local Nassau County job" },
  { src: "/images/IMG_4598.jpg", alt: "Teemer team wrapping large furniture for safe transport" },
  { src: "/images/IMG_4628.jpg", alt: "Teemer Moving & Storage Corp. crew ready for a big move day" },
];

export default function GalleryPage() {
  return (
    <InfoLayout>
      <div className="bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold font-display text-secondary mb-6">Our Work in Action</h1>
          <p className="text-lg text-slate-600 mb-16 max-w-2xl mx-auto">
            A glimpse into how our professional crews handle residential, commercial, and specialty moves across Long Island and NYC.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TEEMER_PHOTOS.map((photo, idx) => (
              <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden group">
                <img 
                  src={photo.src} 
                  alt={photo.alt}
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
