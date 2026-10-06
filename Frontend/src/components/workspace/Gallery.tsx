import React, { useState, useEffect } from "react";
import { 
  Image as ImageIcon, 
  Video, 
  PlayCircle, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Link as LinkIcon,
  Calendar,
  Loader2,
  ExternalLink,
  Folder,
  Layers,
  Camera,
  Film
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

export interface MediaItem {
  file_id?: string | null;
  name?: string | null;
  media_type: "image" | "video";
  url: string;
}

export interface GalleryEventItem {
  id?: string;
  _id?: string;
  event_name: string;
  date?: string;
  link?: string;
  images?: string[];
  media_items?: MediaItem[];
  created_by?: any;
  created_at?: string;
  updated_at?: string;
}

export type LinkType = "google_photos" | "google_drive_folder" | "google_drive_file" | "direct_image" | "unknown";

// Classify Link Type
export function classifyLink(url: string): { type: LinkType; url: string; embedUrl?: string; fileId?: string; folderId?: string } {
  if (!url) return { type: "unknown", url: "" };
  const str = url.trim();

  // 1. Google Photos Album Link
  if (str.includes("photos.google.com") || str.includes("photos.app.goo.gl") || str.includes("goo.gl/photos")) {
    return {
      type: "google_photos",
      url: str,
      embedUrl: str
    };
  }

  // 2. Google Drive Folder Link
  const folderMatch = str.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return {
      type: "google_drive_folder",
      url: str,
      folderId: folderMatch[1],
      embedUrl: `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`
    };
  }

  if (str.includes("drive.google.com") && (str.includes("folder") || str.includes("folderview"))) {
    const m = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) {
      return {
        type: "google_drive_folder",
        url: str,
        folderId: m[1],
        embedUrl: `https://drive.google.com/embeddedfolderview?id=${m[1]}#grid`
      };
    }
  }

  // 3. Google Drive File Link
  if (str.includes("drive.google.com")) {
    const fileMatch = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch && fileMatch[1]) {
      return {
        type: "google_drive_file",
        url: str,
        fileId: fileMatch[1],
        embedUrl: `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w1000`
      };
    }

    const idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1] && !str.includes("folder") && !str.includes("folderview")) {
      return {
        type: "google_drive_file",
        url: str,
        fileId: idMatch[1],
        embedUrl: `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`
      };
    }
  }

  // 4. Direct Image URL
  if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("/")) {
    return {
      type: "direct_image",
      url: str
    };
  }

  return { type: "unknown", url: str };
}

// Helper to convert relative media URLs to full URL
export function getMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const baseUrl = ((import.meta.env as any).VITE_API_URL as string) || "http://localhost:8000/api/v1";
  const origin = baseUrl.replace(/\/api\/v1\/?$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Helper to get streamable video URL
export function getVideoStreamUrl(url: string): string {
  if (!url) return "";
  return getMediaUrl(url);
}

// Helper to check if a URL is a video by extension or keywords
export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const str = url.toLowerCase();
  if (/\.(mp4|webm|mov|mkv|avi|m3u8|ogv|flv|3gp|wmv|m4v)(\?|$)/i.test(str)) return true;
  if (str.includes("youtube.com") || str.includes("youtu.be") || str.includes("vimeo.com")) return true;
  if (str.includes("video") || str.includes("videoplayback") || str.includes("mime=video") || str.includes("video/")) return true;
  return false;
}

// Helper to extract Google Drive File ID from URL
export function getDriveFileId(url: string): string | null {
  if (!url) return null;
  const match = 
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || 
    url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    url.match(/\/thumbnail\?id=([a-zA-Z0-9_-]+)/) ||
    url.match(/export=view&id=([a-zA-Z0-9_-]+)/);
  return match && match[1] ? match[1] : null;
}

// Extract all viewable image URLs from item link & images array
export function getAlbumImages(item: GalleryEventItem): string[] {
  const images: string[] = [];

  if (item.images && Array.isArray(item.images)) {
    item.images.forEach(img => {
      if (!img) return;
      const classified = classifyLink(img);
      if (classified.type === "google_drive_file" && classified.embedUrl) {
        if (!images.includes(classified.embedUrl)) images.push(classified.embedUrl);
      } else if (classified.type === "direct_image") {
        if (!images.includes(classified.url)) images.push(classified.url);
      }
    });
  }

  if (item.link) {
    const classified = classifyLink(item.link);
    if (classified.type === "google_drive_file" && classified.embedUrl) {
      if (!images.includes(classified.embedUrl)) images.push(classified.embedUrl);
    } else if (classified.type === "direct_image") {
      if (!images.includes(classified.url)) images.push(classified.url);
    } else {
      const parts = item.link.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      parts.forEach(part => {
        const partClassified = classifyLink(part);
        if (partClassified.type === "google_drive_file" && partClassified.embedUrl) {
          if (!images.includes(partClassified.embedUrl)) images.push(partClassified.embedUrl);
        } else if (partClassified.type === "direct_image") {
          if (!images.includes(partClassified.url)) images.push(partClassified.url);
        }
      });
    }
  }

  return images;
}

// Extract unified MediaItem[] for an event album with backwards compatibility
export function getUnifiedMediaItems(item: GalleryEventItem): MediaItem[] {
  if (item.media_items && Array.isArray(item.media_items) && item.media_items.length > 0) {
    return item.media_items.map(m => {
      const fid = m.file_id || getDriveFileId(m.url) || (item.link ? getDriveFileId(item.link) : null);
      return {
        file_id: fid,
        name: m.name || fid || "Media Item",
        media_type: m.media_type || (isVideoUrl(m.url) ? "video" : "image"),
        url: m.url
      };
    });
  }

  const rawImages = getAlbumImages(item);
  return rawImages.map(imgUrl => {
    const fid = getDriveFileId(imgUrl) || (item.link ? getDriveFileId(item.link) : null);
    const isVid = isVideoUrl(imgUrl) || Boolean(fid);
    return {
      file_id: fid,
      name: fid || imgUrl.split("/").pop() || "Media Item",
      media_type: isVid ? "video" : "image",
      url: imgUrl
    };
  });
}

export function Gallery() {
  const [events, setEvents] = useState<GalleryEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<GalleryEventItem | null>(null);
  const [formData, setFormData] = useState<{
    event_name: string;
    date: string;
    link: string;
    images: string[];
    media_items: MediaItem[];
  }>({
    event_name: "",
    date: "",
    link: "",
    images: [],
    media_items: []
  });
  const [uploading, setUploading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Lightbox / Detail View State
  const [selectedAlbum, setSelectedAlbum] = useState<GalleryEventItem | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number | null>(null);

  // Fetch gallery events from backend
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await api.get<any>("/gallery?limit=100", { showLoader: false });
      const items = response?.items || response?.data || [];
      setEvents(items);
    } catch (err: any) {
      console.error("Failed to fetch gallery events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      event_name: "",
      date: new Date().toISOString().split("T")[0] || "",
      link: "",
      images: [],
      media_items: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (e: React.MouseEvent, item: GalleryEventItem) => {
    e.stopPropagation();
    setEditingItem(item);
    const unified = getUnifiedMediaItems(item);
    setFormData({
      event_name: item.event_name || "",
      date: item.date || "",
      link: item.link || "",
      images: item.images || unified.map(m => m.url),
      media_items: unified
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({ event_name: "", date: "", link: "", images: [], media_items: [] });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      const newItems: MediaItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) {
          const res = await api.uploadImage(file, "gallery");
          if (res?.url) {
            const isVid = file.type.startsWith("video/") || isVideoUrl(file.name);
            newItems.push({
              file_id: null,
              name: file.name,
              media_type: isVid ? "video" : "image",
              url: res.url
            });
          }
        }
      }

      if (newItems.length > 0) {
        setFormData(prev => ({
          ...prev,
          media_items: [...prev.media_items, ...newItems],
          images: [...prev.images, ...newItems.map(m => m.url)],
          link: prev.link || newItems[0]?.url || ""
        }));
        toast.success(`${newItems.length} file(s) uploaded successfully!`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleMediaType = (idx: number, type: "image" | "video") => {
    setFormData(prev => {
      const updated = [...prev.media_items];
      if (updated[idx]) {
        updated[idx] = { ...updated[idx], media_type: type };
      }
      return { ...prev, media_items: updated };
    });
  };

  const handleRemoveMediaFromForm = (idx: number) => {
    setFormData(prev => {
      const updatedMedia = [...prev.media_items];
      updatedMedia.splice(idx, 1);
      const updatedImgs = [...prev.images];
      if (updatedImgs[idx]) updatedImgs.splice(idx, 1);
      return { ...prev, media_items: updatedMedia, images: updatedImgs };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.event_name.trim()) {
      toast.error("Please enter an Event Name");
      return;
    }

    try {
      setSubmitting(true);

      const rawLinkInput = formData.link.trim();
      const payload = {
        event_name: formData.event_name.trim(),
        date: formData.date.trim() || undefined,
        link: rawLinkInput || undefined,
        images: formData.images,
        media_items: formData.media_items
      };

      const itemId = editingItem?.id || editingItem?._id;

      if (editingItem && itemId) {
        await api.put(`/gallery/${itemId}`, payload);
        toast.success("Gallery item updated successfully!");
      } else {
        await api.post("/gallery", payload);
        toast.success("New Gallery item created successfully!");
      }

      handleCloseModal();
      fetchEvents();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save gallery item.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, item: GalleryEventItem) => {
    e.stopPropagation();
    const itemId = item.id || item._id;
    if (!itemId) return;

    if (!window.confirm(`Are you sure you want to delete "${item.event_name}"?`)) {
      return;
    }

    try {
      await api.delete(`/gallery/${itemId}`);
      toast.success("Gallery item deleted successfully!");
      if (selectedAlbum?.id === itemId || selectedAlbum?._id === itemId) {
        setSelectedAlbum(null);
      }
      fetchEvents();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete gallery item.");
    }
  };

  // Determine cover image (returns string URL if present, or null for Folder/Album Cards)
  const getCoverImage = (item: GalleryEventItem): string | null => {
    const albumImages = getAlbumImages(item);
    if (albumImages.length > 0 && albumImages[0]) {
      return albumImages[0];
    }
    if (item.link) {
      const classified = classifyLink(item.link);
      if (classified.type === "google_drive_file" && classified.embedUrl) return classified.embedUrl;
      if (classified.type === "direct_image" && item.link.startsWith("http")) return item.link;
    }
    return null;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    if (target.src.includes("thumbnail?id=")) {
      const parts = target.src.split("id=");
      const fileId = parts[1]?.split("&")[0];
      if (fileId) {
        target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
      }
    } else if (target.src.includes("lh3.googleusercontent.com")) {
      const parts = target.src.split("/d/");
      const fileId = parts[1]?.split("?")[0];
      if (fileId) {
        target.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }
  };

  const activeMediaItems = selectedAlbum ? getUnifiedMediaItems(selectedAlbum) : [];
  const activeLinkClassified = selectedAlbum?.link ? classifyLink(selectedAlbum.link) : null;

  // Keyboard navigation for Lightbox popup (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (currentImageIndex === null || activeMediaItems.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setCurrentImageIndex((prev) => (prev !== null ? (prev + 1) % activeMediaItems.length : 0));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentImageIndex((prev) => (prev !== null ? (prev - 1 + activeMediaItems.length) % activeMediaItems.length : 0));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setCurrentImageIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentImageIndex, activeMediaItems.length]);

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">Media Gallery</h1>
          <p className="text-muted-foreground mt-2 font-medium">Company events, office tours, and team moments.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Upload Media
          </button>
        </div>
      </div>

      {/* Album List */}
      {!selectedAlbum ? (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 font-semibold text-muted-foreground">Loading Gallery Events...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-3xl border border-dashed border-border/80 p-8">
              <ImageIcon className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">No Media Items Yet</h3>
              <p className="text-muted-foreground text-sm mt-1 mb-6">Start by adding your first event or media upload.</p>
              <button
                onClick={handleOpenAddModal}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Upload Media
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[220px] gap-5">
              {events.map((item, idx) => {
                const coverImage = getCoverImage(item);
                const mediaList = getUnifiedMediaItems(item);
                const classified = item.link ? classifyLink(item.link) : null;
                
                const itemCount = mediaList.length;
                const badgeLabel = `${itemCount} ${itemCount === 1 ? "ITEM" : "ITEMS"}`;

                const isHero = idx === 0;
                const cardSpan = isHero
                  ? "md:col-span-2 md:row-span-2"
                  : "md:col-span-1 md:row-span-1";

                return (
                  <div 
                    key={item.id || item._id || idx} 
                    onClick={() => setSelectedAlbum(item)}
                    className={cn(
                      "group relative overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 border border-border/30 bg-slate-950",
                      isHero ? "rounded-[2rem]" : "rounded-2xl",
                      cardSpan
                    )}
                  >
                    {coverImage ? (
                      <img 
                        src={coverImage} 
                        alt={item.event_name} 
                        referrerPolicy="no-referrer"
                        onError={handleImageError}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                    ) : classified?.type === "google_photos" ? (
                      <div className="w-full h-full bg-gradient-to-br from-rose-950 via-slate-900 to-amber-950 flex flex-col items-center justify-center p-6 text-center group-hover:scale-105 transition-transform duration-700 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.25),transparent_70%)]" />
                        <div className={cn("rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/20 group-hover:scale-110 transition-transform mb-3", isHero ? "w-20 h-20" : "w-12 h-12")}>
                          <Camera className={cn(isHero ? "w-10 h-10" : "w-6 h-6", "text-rose-400")} />
                        </div>
                        <span className={cn("font-bold text-white/90 tracking-wider uppercase", isHero ? "text-sm" : "text-[10px]")}>Google Photos Album</span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 flex flex-col items-center justify-center p-6 text-center group-hover:scale-105 transition-transform duration-700 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2),transparent_70%)]" />
                        <div className={cn("rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/20 group-hover:scale-110 transition-transform mb-3", isHero ? "w-20 h-20" : "w-12 h-12")}>
                          <Folder className={cn(isHero ? "w-10 h-10" : "w-6 h-6", "text-amber-400")} />
                        </div>
                        <span className={cn("font-semibold text-white/80 tracking-wider uppercase", isHero ? "text-sm" : "text-[10px]")}>Google Drive Album</span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    
                    {/* Bottom Info Overlay */}
                    <div className={cn("absolute bottom-0 left-0 right-0 space-y-2", isHero ? "p-7" : "p-4")}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          "bg-black/50 backdrop-blur-md rounded-lg border border-white/15 font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 shadow-sm",
                          isHero ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[10px]"
                        )}>
                          <ImageIcon className={cn(isHero ? "w-3.5 h-3.5" : "w-3 h-3", "text-white/90")} />
                          {badgeLabel}
                        </span>
                        {item.date && (
                          <span className={cn(
                            "font-bold text-white/90 uppercase tracking-wider",
                            isHero ? "text-xs" : "text-[10px]"
                          )}>
                            {item.date}
                          </span>
                        )}
                      </div>
                      <h3 className={cn(
                        "font-black text-white leading-tight drop-shadow-lg tracking-tight",
                        isHero ? "text-3xl sm:text-4xl" : "text-lg sm:text-xl"
                      )}>
                        {item.event_name}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Selected Event Detail View (Inside View) */
        <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedAlbum(null)}
                className="p-3 bg-card hover:bg-muted border border-border/60 rounded-full transition-colors shadow-sm"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <div>
                <h2 className="text-3xl font-black text-foreground">{selectedAlbum.event_name}</h2>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {selectedAlbum.date && (
                    <span className="text-muted-foreground font-medium flex items-center gap-1 text-sm">
                      <Calendar className="w-4 h-4 text-primary" /> {selectedAlbum.date}
                    </span>
                  )}
                  {activeMediaItems.length > 0 && (
                    <span className="text-muted-foreground font-medium text-sm flex items-center gap-1">
                      <Layers className="w-4 h-4 text-primary" /> {activeMediaItems.length} Items
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Compact Icon-Only Action Buttons */}
            <div className="flex items-center gap-2">
              {selectedAlbum.link && (
                <a
                  href={selectedAlbum.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={activeLinkClassified?.type === "google_photos" ? "Open Google Photos Album" : "Open in Google Drive"}
                  className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full transition-all border border-emerald-500/20 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={(e) => handleOpenEditModal(e, selectedAlbum)}
                title="Edit Event"
                className="p-2.5 bg-card hover:bg-muted text-foreground rounded-full transition-all border border-border/60 shadow-sm"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleDelete(e, selectedAlbum)}
                title="Delete Event"
                className="p-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-full transition-all border border-destructive/20 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Photo & Video Media Grid View */}
          {activeMediaItems.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground">Photos & Media ({activeMediaItems.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeMediaItems.map((media, idx) => {
                  const fid = media.file_id || getDriveFileId(media.url);
                  const isVid = media.media_type === "video" || isVideoUrl(media.url) || Boolean(fid);
                  return (
                    <div 
                      key={idx} 
                      className="aspect-square rounded-2xl overflow-hidden cursor-pointer group relative bg-black/5 border border-border/30"
                      onClick={() => setCurrentImageIndex(idx)}
                    >
                      {/* NEVER load iframes inside grid: Thumbnails are always <img> */}
                      <img 
                        src={getMediaUrl(media.url)} 
                        alt={media.name || `Media ${idx + 1}`} 
                        referrerPolicy="no-referrer"
                        onError={handleImageError}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      />
                      {/* ▶ Play Overlay Icon on Video / Drive Thumbnails */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                        {isVid && (
                          <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white border border-white/40 shadow-xl group-hover:scale-110 transition-transform">
                            <PlayCircle className="w-8 h-8 text-white fill-white/80" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-card border border-border/60 rounded-3xl p-6">
              <ImageIcon className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">No Preview Images Available</h3>
              <p className="text-muted-foreground text-sm mt-1 mb-4">You can add image links or upload files by clicking Edit.</p>
              {selectedAlbum.link && (
                <a
                  href={selectedAlbum.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Open Attached Link
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Popup: Rendered only when currentImageIndex !== null */}
      {currentImageIndex !== null && activeMediaItems.length > 0 && (() => {
        const currentMedia = activeMediaItems[currentImageIndex];
        if (!currentMedia) return null;
        const rawUrl = currentMedia.url;
        const currentUrl = getMediaUrl(rawUrl);
        const fileId = currentMedia.file_id || getDriveFileId(rawUrl) || getDriveFileId(currentUrl);
        const isVideo = currentMedia.media_type === "video" || isVideoUrl(currentUrl);

        const driveEmbedUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null;
        const directDriveLink = fileId ? `https://drive.google.com/file/d/${fileId}/view` : currentUrl;

        return (
          <div 
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center cursor-default animate-in fade-in duration-200"
            onClick={(e) => {
              // Close on outside backdrop click
              if (e.target === e.currentTarget) {
                setCurrentImageIndex(null);
              }
            }}
          >
            {/* Top Bar Navigation & Actions */}
            <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
              <a
                href={directDriveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors text-xs font-bold flex items-center gap-1.5 border border-white/20 shadow-md"
                title="Open in Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open in Drive
              </a>
              <button 
                onClick={() => setCurrentImageIndex(null)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer border border-white/20 shadow-md"
                title="Close (Esc)"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Previous Button */}
            {activeMediaItems.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev! - 1 + activeMediaItems.length) % activeMediaItems.length);
                }}
                className="absolute left-4 sm:left-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md z-20 cursor-pointer"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
            )}

            {/* Lightbox Center Content */}
            <div 
              className="w-full max-w-5xl px-4 sm:px-12 flex flex-col items-center justify-center relative h-full pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {driveEmbedUrl ? (
                /* Google Drive Preview Player (Handles both Drive Videos and Documents) */
                <div className="w-full max-w-4xl h-[78vh] flex flex-col items-center justify-center relative">
                  <iframe 
                    key={`drive-iframe-${currentImageIndex}-${fileId}`}
                    src={driveEmbedUrl} 
                    className="w-full h-full rounded-xl shadow-2xl border-0 bg-black animate-in fade-in duration-300" 
                    allow="autoplay; fullscreen" 
                    allowFullScreen
                  />
                </div>
              ) : isVideo ? (
                /* Native MP4 Video Player */
                <div className="w-full max-w-4xl h-[78vh] flex flex-col items-center justify-center relative">
                  <video 
                    key={`native-video-${currentImageIndex}`}
                    src={getVideoStreamUrl(currentUrl)} 
                    controls 
                    autoPlay 
                    {...({ referrerPolicy: "no-referrer" } as any)}
                    className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-2xl animate-in fade-in duration-300"
                  />
                </div>
              ) : (
                /* Image Lightbox View */
                <div className="relative flex items-center justify-center max-w-full max-h-[82vh]">
                  <img 
                    src={currentUrl} 
                    alt={currentMedia.name || "Gallery Full View"} 
                    referrerPolicy="no-referrer"
                    onError={handleImageError}
                    className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-300"
                  />
                </div>
              )}

              {/* Counter Badge */}
              <div className="mt-4 text-white/80 font-medium tracking-wide bg-white/10 px-4 py-1.5 rounded-full text-sm backdrop-blur-md">
                {currentImageIndex + 1} / {activeMediaItems.length}
              </div>
            </div>

            {/* Next Button */}
            {activeMediaItems.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev! + 1) % activeMediaItems.length);
                }}
                className="absolute right-4 sm:right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md z-20 cursor-pointer"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
            )}
          </div>
        );
      })()}

      {/* Add / Edit Modal Popup */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card text-card-foreground border border-border/80 w-full max-w-2xl rounded-3xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 relative my-8">
            <button
              onClick={handleCloseModal}
              className="absolute top-6 right-6 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-black tracking-tight mb-1">
              {editingItem ? "Edit Media Event" : "Upload New Media"}
            </h2>
            <p className="text-muted-foreground text-sm font-medium mb-6">
              {editingItem ? "Update existing gallery event details and media items." : "Add a Google Drive link, Google Photos shared album link, or upload files."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Event / Album Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Sports Day 2026"
                  value={formData.event_name}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Event Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Google Drive / Google Photos Link
                </label>
                <textarea
                  rows={2}
                  placeholder="Paste Google Drive folder URL (drive.google.com/drive/folders/...), single file URL, or Google Photos link here..."
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-input bg-background font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  💡 Folders automatically extract items. Videos (.mp4, .mov, etc.) are detected automatically.
                </p>
              </div>

              {/* File Upload Option */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Direct Upload Media Files
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="direct-file-input"
                />
                <label
                  htmlFor="direct-file-input"
                  className="flex items-center justify-center gap-2 p-3 bg-muted/50 hover:bg-muted border border-dashed border-border rounded-xl cursor-pointer transition-colors text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <Upload className="w-4 h-4 text-primary" />
                  )}
                  {uploading ? "Uploading files..." : "Choose Photo / Video files to upload"}
                </label>
              </div>

              {/* Admin Type Selection for Added Media Items */}
              {formData.media_items.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Media Items ({formData.media_items.length}) - Select Media Type:
                  </label>
                  <div className="space-y-2">
                    {formData.media_items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-muted/40 border border-border/60 rounded-xl gap-3">
                        <span className="text-xs font-medium text-foreground truncate max-w-[240px]">
                          {item.name || item.url}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleMediaType(idx, "image")}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                              item.media_type === "image" 
                                ? "bg-primary text-primary-foreground shadow-sm" 
                                : "bg-card text-muted-foreground border border-border hover:text-foreground"
                            )}
                          >
                            <Camera className="w-3 h-3" /> Image
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleMediaType(idx, "video")}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                              item.media_type === "video" 
                                ? "bg-amber-500 text-white shadow-sm" 
                                : "bg-card text-muted-foreground border border-border hover:text-foreground"
                            )}
                          >
                            <Film className="w-3 h-3" /> Video
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveMediaFromForm(idx)}
                            className="p-1 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            title="Remove Item"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-muted-foreground hover:bg-muted transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className="px-6 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingItem ? "Update Event" : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
