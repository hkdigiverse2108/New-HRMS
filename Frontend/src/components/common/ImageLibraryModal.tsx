import React, { useState, useEffect, useRef } from "react";
import { 
  Images, 
  Upload, 
  Trash2, 
  Check, 
  X, 
  Search, 
  RotateCcw, 
  Folder, 
  Loader2, 
  Image as ImageIcon,
  ExternalLink,
  Plus,
  FileText,
  Film,
  Music,
  FileSpreadsheet,
  FileCode,
  Copy,
  FolderOpen,
  Filter
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { getMediaUrl } from "@/lib/config";
import { useAuth } from "@/components/auth/AuthContext";

export interface StoredImageItem {
  filename: string;
  url: string;
  folder: string;
  size?: number;
  created_at?: number;
  file_type?: "image" | "pdf" | "doc" | "video" | "audio" | "other" | string;
}

export interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
  currentValue?: string | null | undefined;
  defaultFolder?: string;
  title?: string;
}

const FOLDERS = [
  { id: "all", label: "All Uploads" },
  { id: "projects", label: "Projects" },
  { id: "clients", label: "Clients" },
  { id: "employee", label: "Employees" },
  { id: "chat_documents", label: "Chat Attachments" },
  { id: "invoices", label: "Invoices" },
  { id: "quotations", label: "Quotations" },
  { id: "settings", label: "Settings" },
  { id: "common", label: "Common" },
] as const;

const MEDIA_TYPES = [
  { id: "all", label: "All Media" },
  { id: "image", label: "Images" },
  { id: "pdf", label: "PDFs" },
  { id: "doc", label: "Docs" },
  { id: "audio_video", label: "Audio & Video" },
] as const;

export function ImageLibraryModal({
  isOpen,
  onClose,
  onSelect,
  currentValue,
  defaultFolder = "all",
  title = "Stored Files & Media Library",
}: ImageLibraryModalProps) {
  const { user } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase() === "admin" || (user?.role || "").toLowerCase() === "superadmin";
  const [selectedFolder, setSelectedFolder] = useState<string>(defaultFolder);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [images, setImages] = useState<StoredImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Confirmation state for deleting an image
  const [imageToDelete, setImageToDelete] = useState<StoredImageItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync default folder when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedFolder(defaultFolder || "all");
      setSelectedType("all");
      setSearchQuery("");
      fetchImages(defaultFolder || "all");
    }
  }, [isOpen, defaultFolder]);

  const fetchImages = async (folder: string) => {
    setIsLoading(true);
    try {
      const data = await api.listImages(folder === "all" ? undefined : folder);
      setImages(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn("Failed to load images from server storage", err);
      toast.error(err?.message || "Failed to load media library");
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFolderChange = (folderId: string) => {
    setSelectedFolder(folderId);
    fetchImages(folderId);
  };

  const handleUploadNew = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size exceeds 50MB limit.");
      return;
    }

    const uploadTargetFolder = selectedFolder === "all" ? "common" : selectedFolder;
    setIsUploading(true);
    try {
      const res = await api.uploadImage(file, uploadTargetFolder);
      if (res && res.url) {
        toast.success("File uploaded to library successfully!");
        await fetchImages(selectedFolder);
        onSelect(res.url);
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmDelete = async () => {
    if (!imageToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteImage(imageToDelete.url);
      toast.success("File deleted permanently from storage.");
      setImages(prev => prev.filter(img => img.url !== imageToDelete.url));
      
      if (currentValue && (currentValue === imageToDelete.url || currentValue.includes(imageToDelete.filename))) {
        toast.info("Active file was deleted from server storage.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete file.");
    } finally {
      setIsDeleting(false);
      setImageToDelete(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFolderBadgeStyle = (folder: string) => {
    const f = (folder || "").toLowerCase();
    switch (f) {
      case "projects":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30";
      case "clients":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "employee":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "chat_documents":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "invoices":
      case "quotations":
        return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30";
      case "settings":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30";
    }
  };

  const getFolderDisplayName = (folder: string) => {
    const f = (folder || "").toLowerCase();
    switch (f) {
      case "chat_documents": return "Chat Doc";
      case "employee": return "Employee";
      case "projects": return "Projects";
      case "clients": return "Clients";
      case "settings": return "Settings";
      case "invoices": return "Invoices";
      case "quotations": return "Quotations";
      default: return f || "Common";
    }
  };

  const getFileCategory = (item: StoredImageItem): "image" | "pdf" | "doc" | "video" | "audio" | "other" => {
    if (item.file_type && ["image", "pdf", "doc", "video", "audio"].includes(item.file_type)) {
      return item.file_type as any;
    }
    const ext = (item.filename.split('.').pop() || "").toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext)) return "image";
    if (ext === "pdf") return "pdf";
    if (["doc", "docx", "txt", "xls", "xlsx"].includes(ext)) return "doc";
    if (["mp4", "webm"].includes(ext)) return "video";
    if (["mp3", "wav", "ogg"].includes(ext)) return "audio";
    return "other";
  };

  // Filtered by search & type
  const filteredImages = images.filter((img) => {
    // Type filter
    if (selectedType !== "all") {
      const cat = getFileCategory(img);
      if (selectedType === "image" && cat !== "image") return false;
      if (selectedType === "pdf" && cat !== "pdf") return false;
      if (selectedType === "doc" && cat !== "doc") return false;
      if (selectedType === "audio_video" && cat !== "audio" && cat !== "video") return false;
    }

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (img.filename && img.filename.toLowerCase().includes(q)) ||
      (img.folder && img.folder.toLowerCase().includes(q))
    );
  });

  if (!isAdmin && isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full max-w-5xl p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card h-[90vh] max-h-[850px] flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 border-b border-border/50 bg-muted/20 shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-xs">
                <Images className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-xl font-black tracking-tight truncate text-foreground">
                    {title}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hidden sm:inline-block">
                    Unified Storage
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                  Reuse previously uploaded logos, photos & chat documents from unified storage.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fetchImages(selectedFolder)}
                disabled={isLoading}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors shrink-0"
                title="Refresh library"
              >
                <RotateCcw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader / Toolbar */}
          <div className="px-5 sm:px-7 py-3 border-b border-border/50 bg-background/50 space-y-2.5 shrink-0">
            {/* Top Row: Folder filter pills & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Folder filter pills */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {FOLDERS.map((f) => {
                  const isActive = selectedFolder === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleFolderChange(f.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 select-none",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                          : "bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40"
                      )}
                    >
                      <Folder className={cn("w-3.5 h-3.5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                      <span>{f.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Actions: Search & Upload New */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex-1 md:w-56">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search file name or folder..."
                    className="w-full pl-8 pr-3 py-1.5 bg-muted/30 border border-border/60 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,application/pdf,video/mp4,video/webm,audio/mp3,audio/wav"
                  className="hidden"
                  onChange={handleUploadNew}
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload New</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Row: Media type filter tabs */}
            <div className="flex items-center gap-2 pt-1 border-t border-border/30 text-xs text-muted-foreground overflow-x-auto scrollbar-none">
              <span className="font-semibold text-[11px] uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Filter className="w-3 h-3" /> Type:
              </span>
              {MEDIA_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedType(t.id)}
                  className={cn(
                    "px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer",
                    selectedType === t.id
                      ? "bg-foreground/10 text-foreground border border-foreground/20"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
                <p className="text-xs font-semibold">Loading stored files...</p>
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border/60 rounded-2xl bg-muted/10">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground mb-3">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-foreground">No stored files found</h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                  {searchQuery
                    ? `No files matching "${searchQuery}". Try a different keyword.`
                    : `No files uploaded yet in "${selectedFolder}". Click "Upload New" to store one.`}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File Now</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {filteredImages.map((img) => {
                  const fullUrl = getMediaUrl(img.url);
                  const isCurrent = Boolean(
                    currentValue &&
                    (currentValue === img.url ||
                     currentValue === fullUrl ||
                     (currentValue.includes(img.filename) && !currentValue.includes("dicebear")))
                  );
                  const category = getFileCategory(img);

                  return (
                    <div
                      key={img.url}
                      className={cn(
                        "group relative rounded-2xl border bg-card transition-all duration-200 overflow-hidden flex flex-col shadow-2xs hover:shadow-md",
                        isCurrent 
                          ? "border-emerald-500 ring-2 ring-emerald-500/30" 
                          : "border-border/60 hover:border-primary/40"
                      )}
                    >
                      {/* Image / Media Thumbnail Box */}
                      <div 
                        onClick={() => {
                          onSelect(img.url);
                          onClose();
                          toast.success("Selected from library!");
                        }}
                        className="relative w-full aspect-square bg-muted/20 flex flex-col items-center justify-center p-2.5 overflow-hidden cursor-pointer group-hover:bg-primary/5 transition-colors"
                      >
                        {/* Prominent Folder Badge (Visible in "All Uploads" filter!) */}
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black border shadow-xs flex items-center gap-1", getFolderBadgeStyle(img.folder))}>
                            <Folder className="w-2.5 h-2.5" />
                            <span>{getFolderDisplayName(img.folder)}</span>
                          </span>
                        </div>

                        {/* Current Selection Active Badge */}
                        {isCurrent && (
                          <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black shadow-xs flex items-center gap-1">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            <span>Active</span>
                          </div>
                        )}

                        {/* Rendering by Category */}
                        {category === "image" ? (
                          <img
                            src={fullUrl}
                            alt={img.filename}
                            className="w-full h-full object-contain rounded-xl transition-transform duration-300 group-hover:scale-105 pt-5"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(img.filename)}`;
                            }}
                          />
                        ) : category === "pdf" ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 pt-6 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50">
                            <FileText className="w-10 h-10 text-rose-500 mb-1" />
                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50">
                              PDF Document
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate w-full mt-1 px-1">
                              {img.filename}
                            </span>
                          </div>
                        ) : category === "video" ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 pt-6 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50">
                            <Film className="w-10 h-10 text-purple-500 mb-1" />
                            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50">
                              Video Media
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate w-full mt-1 px-1">
                              {img.filename}
                            </span>
                          </div>
                        ) : category === "audio" ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 pt-6 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50">
                            <Music className="w-10 h-10 text-amber-500 mb-1" />
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50">
                              Audio File
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate w-full mt-1 px-1">
                              {img.filename}
                            </span>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-center p-3 pt-6 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50">
                            <FileSpreadsheet className="w-10 h-10 text-blue-500 mb-1" />
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50">
                              Attachment
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate w-full mt-1 px-1">
                              {img.filename}
                            </span>
                          </div>
                        )}

                        {/* Hover Overlay with Select Prompt */}
                        <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                          <span className="px-3 py-1.5 bg-primary text-primary-foreground font-black text-xs rounded-xl shadow-md transform -translate-y-1 group-hover:translate-y-0 transition-transform">
                            {isCurrent ? "Current Selection" : "Select File"}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer: Metadata, Copy URL & Delete Button */}
                      <div className="p-2 sm:p-2.5 border-t border-border/40 bg-background/50 flex items-center justify-between gap-1.5 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-foreground truncate" title={img.filename}>
                            {img.filename}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                            <span className="capitalize font-semibold text-foreground/70">{getFolderDisplayName(img.folder)}</span>
                            {img.size ? <span>• {formatFileSize(img.size)}</span> : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Copy URL button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(fullUrl);
                              toast.success("File URL copied to clipboard!");
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                            title="Copy file URL"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button (with Confirmation Modal) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImageToDelete(img);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete permanently from storage (requires confirmation)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-5 sm:px-7 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between shrink-0">
            <span className="text-xs text-muted-foreground font-medium">
              Total <strong className="text-foreground">{filteredImages.length}</strong> file{filteredImages.length !== 1 ? "s" : ""} found in <span className="capitalize text-foreground font-bold">{selectedFolder === "all" ? "All Uploads" : selectedFolder}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal Before Permanent Deletion */}
      <ConfirmModal
        isOpen={Boolean(imageToDelete)}
        onClose={() => setImageToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Stored File?"
        itemName={imageToDelete?.filename}
        description="Are you sure you want to permanently delete this file from server storage? Any project, client, profile, or message using this file will no longer be able to display it."
        confirmText={isDeleting ? "Deleting..." : "Delete Permanently"}
        variant="destructive"
      />
    </>
  );
}
