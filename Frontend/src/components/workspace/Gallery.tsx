import React, { useState } from "react";
import { Image as ImageIcon, Video, PlayCircle, X, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const ALBUMS = [
  {
    id: "a1",
    title: "Annual Company Retreat 2025",
    date: "March 15, 2025",
    cover: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&q=80",
    itemCount: 124,
    type: "event",
    featured: true
  },
  {
    id: "a2",
    title: "New Office Tour",
    date: "Jan 10, 2025",
    cover: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    itemCount: 45,
    type: "office",
    featured: false
  },
  {
    id: "a3",
    title: "Q1 Townhall Meeting",
    date: "April 02, 2025",
    cover: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80",
    itemCount: 12,
    type: "video",
    featured: false
  },
  {
    id: "a4",
    title: "Team Building - Escape Room",
    date: "Feb 22, 2025",
    cover: "https://images.unsplash.com/photo-1578357061845-c6181f621183?w=800&q=80",
    itemCount: 28,
    type: "event",
    featured: false
  }
];

export function Gallery() {
  const [filterType, setFilterType] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number | null>(null);

  const filteredAlbums = filterType ? ALBUMS.filter(a => a.type === filterType) : ALBUMS;
  const activeAlbum = ALBUMS.find(a => a.id === selectedAlbum);

  const handleOpenAlbum = (albumId: string) => {
    setSelectedAlbum(albumId);
  };

  const handleCloseAlbum = () => {
    setSelectedAlbum(null);
  };

  const MOCK_PHOTOS = [
    "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&q=80",
    "https://images.unsplash.com/photo-1578357061845-c6181f621183?w=1600&q=80",
  ];

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentImageIndex !== null) {
      setCurrentImageIndex((prev) => (prev! + 1) % MOCK_PHOTOS.length);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentImageIndex !== null) {
      setCurrentImageIndex((prev) => (prev! - 1 + MOCK_PHOTOS.length) % MOCK_PHOTOS.length);
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Media Gallery</h1>
          <p className="text-muted-foreground mt-2 font-medium">Company events, office tours, and team moments.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              const fileInput = document.createElement("input");
              fileInput.type = "file";
              fileInput.accept = "image/*,video/*";
              fileInput.onchange = () => {
                alert("Media uploaded successfully (Mock Mode).");
              };
              fileInput.click();
            }}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm"
          >
            Upload Media
          </button>
        </div>
      </div>

      {!selectedAlbum ? (
        <>
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            <button 
              onClick={() => setFilterType(null)}
              className={cn("px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all border", !filterType ? "bg-foreground text-background border-transparent" : "bg-card border-border/60 text-muted-foreground hover:bg-muted/50")}
            >
              All Albums
            </button>
            <button 
              onClick={() => setFilterType("event")}
              className={cn("px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all border", filterType === "event" ? "bg-foreground text-background border-transparent" : "bg-card border-border/60 text-muted-foreground hover:bg-muted/50")}
            >
              Events & Retreats
            </button>
            <button 
              onClick={() => setFilterType("office")}
              className={cn("px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all border", filterType === "office" ? "bg-foreground text-background border-transparent" : "bg-card border-border/60 text-muted-foreground hover:bg-muted/50")}
            >
              Office Life
            </button>
            <button 
              onClick={() => setFilterType("video")}
              className={cn("px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all border", filterType === "video" ? "bg-foreground text-background border-transparent" : "bg-card border-border/60 text-muted-foreground hover:bg-muted/50")}
            >
              Videos
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAlbums.map(album => (
              <div key={album.id} 
                   onClick={() => handleOpenAlbum(album.id)}
                   className={cn(
                "group relative rounded-3xl overflow-hidden cursor-pointer hover:shadow-xl transition-all border border-border/20",
                album.featured ? "md:col-span-2 md:row-span-2 min-h-[400px]" : "aspect-square md:aspect-auto md:h-64"
              )}>
                <img src={album.cover} alt={album.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {/* Play button overlay for videos */}
                {album.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="w-12 h-12 text-white/80 group-hover:text-white transition-colors group-hover:scale-110" />
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-white/20 backdrop-blur-md rounded-md text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1">
                      {album.type === "video" ? <Video className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                      {album.itemCount} Items
                    </span>
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                      {album.date}
                    </span>
                  </div>
                  <h3 className={cn("font-black text-white leading-tight", album.featured ? "text-3xl" : "text-xl")}>
                    {album.title}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="flex items-center gap-4 mb-8">
            <button 
              onClick={handleCloseAlbum}
              className="p-3 bg-card hover:bg-muted border border-border/60 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h2 className="text-3xl font-black text-foreground">{activeAlbum?.title}</h2>
              <p className="text-muted-foreground font-medium">{activeAlbum?.date} • {activeAlbum?.itemCount} items</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MOCK_PHOTOS.map((photoUrl, idx) => (
              <div 
                key={idx} 
                className="aspect-square rounded-2xl overflow-hidden cursor-pointer group relative"
                onClick={() => setCurrentImageIndex(idx)}
              >
                <img 
                  src={photoUrl} 
                  alt={`Photo ${idx + 1}`} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      {currentImageIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center">
          <button 
            onClick={() => setCurrentImageIndex(null)}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <button 
            onClick={handlePrev}
            className="absolute left-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <div className="w-full max-w-5xl px-12 flex items-center justify-center relative h-full">
            <img 
              src={MOCK_PHOTOS[currentImageIndex!]} 
              alt="Gallery Image" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in fade-in zoom-in-95 duration-300"
            />
            <div className="absolute bottom-10 left-0 right-0 text-center text-white/70 font-medium tracking-wide">
              {currentImageIndex! + 1} / {MOCK_PHOTOS.length}
            </div>
          </div>

          <button 
            onClick={handleNext}
            className="absolute right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  );
}
