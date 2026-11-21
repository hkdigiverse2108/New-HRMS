import React, { useState, useEffect, useRef } from "react";
import { 
  Check, 
  Clock, 
  Calendar, 
  ExternalLink, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Share2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Video, 
  Image as ImageIcon, 
  Sparkles,
  Layers,
  CheckCheck,
  Send,
  X,
  Eye,
  Filter,
  Link2,
  Folder,
  Instagram,
  Play
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl, getMediaUrl as resolveMediaUrl } from "@/lib/config";

interface ClientReviewItem {
  id: string;
  topic: string;
  type: string;
  posting_date: string;
  status: string;
  caption: string;
  reference_link: string;
  topic_description?: string;
  final_post_link: string;
  final_reel_link: string;
  instagram_link: string;
  thumbnail?: any;
  script?: any;
  editing?: any;
  shoot?: any;
  carousel_images?: string[];
  issues?: any[];
  remark?: string;
}

interface ProjectSummary {
  id: string;
  name: string;
  client_name: string;
  company_name: string;
  category: string;
  status: string;
}

interface MediaAsset {
  id: string;
  kind: "image" | "video" | "gdrive_file" | "gdrive_folder" | "instagram" | "youtube" | "link";
  url: string;
  fileId?: string | undefined;
  folderId?: string | undefined;
  shortcode?: string | undefined;
  videoId?: string | undefined;
}

// Extract and parse all media links for an item
const extractMediaAssets = (item: ClientReviewItem): MediaAsset[] => {
  const rawList: string[] = [];

  const addCandidate = (val: any) => {
    if (!val) return;
    if (typeof val === "string") {
      const tokens = val.split(/[\s,]+/);
      for (const t of tokens) {
        const clean = t.trim().replace(/^['"]|['"]$/g, "");
        if (
          clean &&
          clean !== "-" &&
          clean !== "--" &&
          clean !== "None" &&
          clean !== "null" &&
          clean !== "Not Required" &&
          clean !== "not required" &&
          clean !== "Done" &&
          clean !== "done"
        ) {
          if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("/uploads/") || clean.startsWith("/")) {
            rawList.push(clean);
          }
        }
      }
    } else if (typeof val === "object") {
      if (val.link && typeof val.link === "string") {
        addCandidate(val.link);
      }
      if (Array.isArray(val)) {
        val.forEach(addCandidate);
      }
    }
  };

  // 1. Carousel / multiple images (including Drive folder images resolved by backend)
  if (item.carousel_images && Array.isArray(item.carousel_images) && item.carousel_images.length > 0) {
    addCandidate(item.carousel_images);
  }

  // 2. Editing link (often holds final videos or designs or multiple drive links)
  addCandidate(item.editing);

  // 3. Final links
  addCandidate(item.final_reel_link);
  addCandidate(item.final_post_link);

  // 4. Thumbnail link
  addCandidate(item.thumbnail);

  // NOTE: Do NOT add reference_link or instagram_link to deliverable media assets!
  // Reference belongs strictly in the reference section below caption.

  // Deduplicate URLs while preserving order
  let uniqueUrls: string[] = [];
  for (const u of rawList) {
    if (!uniqueUrls.includes(u)) {
      uniqueUrls.push(u);
    }
  }

  // If we already resolved individual files from a Google Drive folder, remove the raw folder URL from slides
  const hasResolvedDriveFiles = uniqueUrls.some(u => u.includes("drive.google.com/file/d/"));
  if (hasResolvedDriveFiles) {
    uniqueUrls = uniqueUrls.filter(u => !u.includes("drive.google.com/drive/folders/"));
  }

  return uniqueUrls.map((rawUrl, idx) => {
    const url = resolveMediaUrl(rawUrl);

    // Google Drive Folder
    const folderMatch = rawUrl.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/i);
    const folderId = folderMatch?.[1];
    if (folderMatch && folderId) {
      return {
        id: `asset-${idx}-${folderId}`,
        kind: "gdrive_folder",
        url: rawUrl,
        folderId
      };
    }

    // Google Drive File
    const fileMatch = rawUrl.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
    const fileId = fileMatch?.[1];
    if (fileMatch && fileId) {
      return {
        id: `asset-${idx}-${fileId}`,
        kind: "gdrive_file",
        url: rawUrl,
        fileId
      };
    }

    // Instagram
    const igMatch = rawUrl.match(/instagram\.com\/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/i);
    const shortcode = igMatch?.[1];
    if (igMatch && shortcode) {
      return {
        id: `asset-${idx}-${shortcode}`,
        kind: "instagram",
        url: rawUrl,
        shortcode
      };
    }

    // YouTube
    const ytMatch = rawUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/i);
    const videoId = ytMatch?.[1];
    if (ytMatch && videoId) {
      return {
        id: `asset-${idx}-${videoId}`,
        kind: "youtube",
        url: rawUrl,
        videoId
      };
    }

    // Direct Video
    if (rawUrl.match(/\.(mp4|mov|webm|m4v)($|\?)/i) || (item.type === "Reel" && !rawUrl.match(/\.(jpg|jpeg|png|webp|gif)($|\?)/i))) {
      return {
        id: `asset-${idx}`,
        kind: "video",
        url
      };
    }

    // Direct Image
    if (rawUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) || rawUrl.includes("/uploads/")) {
      return {
        id: `asset-${idx}`,
        kind: "image",
        url
      };
    }

    return {
      id: `asset-${idx}`,
      kind: "link",
      url: rawUrl
    };
  });
};

// Component to handle Google Drive image vs preview iframe
function GDriveMediaViewer({
  fileId,
  isReel,
  topic
}: {
  fileId: string;
  isReel: boolean;
  topic: string;
}) {
  const [imgError, setImgError] = useState(false);

  // If it's a Reel, embed the preview iframe directly (it provides the full Google video player)
  if (isReel) {
    return (
      <iframe
        src={`https://drive.google.com/file/d/${fileId}/preview`}
        className="w-full h-full border-0 bg-black"
        allow="autoplay; encrypted-media"
        allowFullScreen
        title={topic}
      />
    );
  }

  // If it's a Post or Story, directly render Google Drive high-resolution thumbnail image
  // with referrerPolicy="no-referrer" to display full visual cleanly without zoom/control bars
  if (!imgError) {
    return (
      <img
        src={`https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`}
        referrerPolicy="no-referrer"
        alt={topic}
        onError={() => setImgError(true)}
        className="w-full h-full object-contain"
      />
    );
  }

  return (
    <iframe
      src={`https://drive.google.com/file/d/${fileId}/preview`}
      className="w-full h-full border-0 bg-black"
      allow="autoplay; encrypted-media"
      allowFullScreen
      title={topic}
    />
  );
}

// Media Gallery Component for Deliverables
function DeliverableMediaGallery({
  item,
  assets,
  onOpenPreview
}: {
  item: ClientReviewItem;
  assets: MediaAsset[];
  onOpenPreview: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (assets.length === 0) {
    return (
      <div className="relative w-full h-[260px] bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 gap-1.5 border-b border-slate-100 dark:border-slate-800">
        <ImageIcon className="w-8 h-8 opacity-40" />
        <span className="text-[11px] font-semibold">Visual In Production</span>
      </div>
    );
  }

  const currentAsset = assets[Math.min(activeIdx, assets.length - 1)];
  if (!currentAsset) return null;

  return (
    <div className="relative w-full h-[380px] sm:h-[430px] bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-100 dark:border-slate-800 group">
      {/* Current Asset Display */}
      {currentAsset.kind === "video" && (
        <video
          controls
          playsInline
          preload="metadata"
          src={currentAsset.url}
          className="w-full h-full object-contain bg-black"
        />
      )}

      {currentAsset.kind === "image" && (
        <img
          src={currentAsset.url}
          referrerPolicy="no-referrer"
          alt={item.topic}
          className="w-full h-full object-contain hover:scale-105 transition-transform duration-300 cursor-pointer"
          onClick={onOpenPreview}
        />
      )}

      {currentAsset.kind === "gdrive_file" && currentAsset.fileId && (
        <GDriveMediaViewer
          fileId={currentAsset.fileId}
          isReel={item.type === "Reel"}
          topic={item.topic}
        />
      )}

      {currentAsset.kind === "gdrive_folder" && (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-800 to-slate-900 text-center relative text-white">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary mb-2 shadow-xs group-hover:scale-110 transition-transform">
            <Folder className="w-6 h-6" />
          </div>
          <span className="text-xs font-black tracking-wide">
            Google Drive Deliverables Folder
          </span>
          <p className="text-[10px] text-slate-400 max-w-xs mt-0.5 line-clamp-1">
            Raw files, creative edits & assets
          </p>
          <a
            href={currentAsset.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-2.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span>Open Folder in Drive</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {currentAsset.kind === "instagram" && (
        <iframe
          src={`https://www.instagram.com/p/${currentAsset.shortcode}/embed/captioned/`}
          className="w-full h-full border-0 bg-white"
          allowFullScreen
          title={item.topic}
        />
      )}

      {currentAsset.kind === "youtube" && (
        <iframe
          src={`https://www.youtube.com/embed/${currentAsset.videoId}`}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={item.topic}
        />
      )}

      {currentAsset.kind === "link" && (
        <a
          href={currentAsset.url}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-2 p-4 text-center group cursor-pointer text-white"
        >
          <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <ExternalLink className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold text-white group-hover:underline flex items-center gap-1">
            View Deliverable File <ExternalLink className="w-3 h-3" />
          </span>
        </a>
      )}

      {/* Multiple Assets Navigation (Gallery Carousel) */}
      {assets.length > 1 && (
        <>
          {/* Slide Indicator Badge */}
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 border border-white/10">
              <Layers className="w-3 h-3 text-primary" />
              {activeIdx + 1} / {assets.length} Slides
            </span>
          </div>

          {/* Left / Right Arrow Buttons */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIdx(prev => (prev === 0 ? assets.length - 1 : prev - 1));
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg cursor-pointer"
            title="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveIdx(prev => (prev === assets.length - 1 ? 0 : prev + 1));
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg cursor-pointer"
            title="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Bottom Dots Indicator */}
          <div className="absolute bottom-2 inset-x-0 z-20 flex items-center justify-center gap-1.5 pointer-events-auto">
            {assets.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx(i);
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all cursor-pointer",
                  activeIdx === i ? "w-5 bg-primary" : "w-1.5 bg-white/60 hover:bg-white"
                )}
                title={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Render Reference Link & Notes Section
function ReferenceSection({
  item,
  onCopyRef,
  copiedRefId
}: {
  item: ClientReviewItem;
  onCopyRef: (link: string, id: string) => void;
  copiedRefId: string | null;
}) {
  const ref = (item.reference_link || "").trim();
  const desc = (item.topic_description || "").trim();

  if (!ref && !desc) return null;

  const isUrl = ref.startsWith("http://") || ref.startsWith("https://");
  const isInstagram = isUrl && (ref.includes("instagram.com/p/") || ref.includes("instagram.com/reel/") || ref.includes("instagram.com/reels/"));
  const isPinterest = isUrl && (ref.includes("pinterest.com"));
  const isDrive = isUrl && (ref.includes("drive.google.com"));

  return (
    <div className="space-y-2">
      {/* If it's a URL */}
      {isUrl && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1.5">
              {isInstagram ? (
                <>
                  <Instagram className="w-3 h-3 text-pink-500" /> Instagram Reference
                </>
              ) : isPinterest ? (
                <>
                  <Link2 className="w-3 h-3 text-red-500" /> Pinterest Inspiration
                </>
              ) : isDrive ? (
                <>
                  <Folder className="w-3 h-3 text-blue-500" /> Google Drive Reference
                </>
              ) : (
                <>
                  <Link2 className="w-3 h-3 text-primary" /> Reference / Inspiration Link
                </>
              )}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">Click to preview</span>
          </div>

          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between gap-2 shadow-2xs hover:border-primary/40 transition-colors">
            <a
              href={ref}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-primary dark:hover:text-primary transition-colors truncate flex-1 flex items-center gap-1.5"
              title={ref}
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{ref}</span>
            </a>
            <button
              type="button"
              onClick={() => onCopyRef(ref, item.id)}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-slate-900 dark:hover:text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1 shrink-0 text-[10px] font-bold"
              title="Copy link"
            >
              {copiedRefId === item.id ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500 text-[10px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* If reference is plain text (not a URL) */}
      {!isUrl && ref && (
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Reference & Idea Notes
          </span>
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 text-xs text-slate-700 dark:text-slate-200 font-medium">
            "{ref}"
          </div>
        </div>
      )}

      {/* If there is a separate topic description */}
      {desc && desc !== ref && (
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1">
            📝 Creative Brief / Direction
          </span>
          <div className="px-3 py-2 bg-slate-50/70 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
            {desc}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientReviewPortal() {
  const [projectId, setProjectId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const searchParams = new URLSearchParams(window.location.search);
    if (pathParts.length >= 2 && (pathParts[0] === "client-review" || pathParts[0] === "review")) {
      return pathParts[1] || "";
    }
    return searchParams.get("project") || searchParams.get("projectId") || "";
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [items, setItems] = useState<ClientReviewItem[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("month") || "";
  });
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [viewMode, setViewMode] = useState<"cards" | "calendar">("cards");

  // Custom Dropdown & expansion states
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const monthDropdownRef = useRef<HTMLDivElement>(null);
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});
  const [copiedCaptionId, setCopiedCaptionId] = useState<string | null>(null);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);

  // Modals
  const [previewModalItem, setPreviewModalItem] = useState<ClientReviewItem | null>(null);
  const [fullCaptionModalItem, setFullCaptionModalItem] = useState<ClientReviewItem | null>(null);

  // Feedback modal
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    item: ClientReviewItem | null;
    feedbackText: string;
    clientName: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    item: null,
    feedbackText: "",
    clientName: "",
    isSubmitting: false
  });

  // Bulk approve modal
  const [isBulkApproveOpen, setIsBulkApproveOpen] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // Close month dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setMonthDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Re-check projectId & month if URL changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const searchParams = new URLSearchParams(window.location.search);
    
    let pId = "";
    if (pathParts.length >= 2 && (pathParts[0] === "client-review" || pathParts[0] === "review")) {
      pId = pathParts[1] || "";
    } else {
      pId = searchParams.get("project") || searchParams.get("projectId") || "";
    }
    
    const m = searchParams.get("month") || "";
    if (pId && pId !== projectId) setProjectId(pId);
    if (m && m !== selectedMonth) setSelectedMonth(m);
  }, []);

  const fetchReviewData = async (projId: string, monthVal?: string) => {
    if (!projId) return;
    setLoading(true);
    setError(null);
    try {
      const baseUrl = getApiUrl();
      const monthQuery = monthVal && monthVal !== "All" ? `?month=${encodeURIComponent(monthVal)}` : "";
      const res = await fetch(`${baseUrl}/public/content-review/${projId}${monthQuery}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? "Content calendar not found or link has expired." : "Failed to load review data.");
      }
      const data = await res.json();
      setProject(data.project);
      setItems(data.items || []);
      const months = data.available_months || [];
      setAvailableMonths(months);
      if (monthVal && monthVal !== "All") {
        setSelectedMonth(monthVal);
      } else if (data.selected_month && data.selected_month !== "All") {
        setSelectedMonth(data.selected_month);
      } else if (months.length > 0) {
        setSelectedMonth(months[0]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load review data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchReviewData(projectId, selectedMonth);
    }
  }, [projectId]);

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    if (projectId) {
      fetchReviewData(projectId, newMonth);
    }
  };

  const handlePrevMonth = () => {
    const ym = selectedMonth && selectedMonth !== "All" ? selectedMonth : (availableMonths[0] || new Date().toISOString().slice(0, 7));
    const parts = ym.split("-");
    const y = Number(parts[0]) || new Date().getFullYear();
    const m = Number(parts[1]) || (new Date().getMonth() + 1);
    const prevDate = new Date(y, m - 2, 1);
    const prevStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    handleMonthChange(prevStr);
  };

  const handleNextMonth = () => {
    const ym = selectedMonth && selectedMonth !== "All" ? selectedMonth : (availableMonths[0] || new Date().toISOString().slice(0, 7));
    const parts = ym.split("-");
    const y = Number(parts[0]) || new Date().getFullYear();
    const m = Number(parts[1]) || (new Date().getMonth() + 1);
    const nextDate = new Date(y, m, 1);
    const nextStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
    handleMonthChange(nextStr);
  };

  const handleApproveItem = async (item: ClientReviewItem) => {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/public/content-review/${projectId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_item",
          item_id: item.id,
          client_name: project?.client_name || "Client"
        })
      });
      if (!res.ok) throw new Error("Failed to approve item");
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "Approved" } : i));
      if (previewModalItem?.id === item.id) {
        setPreviewModalItem(prev => prev ? { ...prev, status: "Approved" } : null);
      }
    } catch (err: any) {
      alert("Error: " + (err.message || "Could not approve"));
    }
  };

  const handleBulkApprove = async () => {
    setIsBulkSubmitting(true);
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/public/content-review/${projectId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_all",
          month: selectedMonth,
          client_name: project?.client_name || "Client"
        })
      });
      if (!res.ok) throw new Error("Failed to approve items");
      setItems(prev => prev.map(i => ({ ...i, status: "Approved" })));
      setIsBulkApproveOpen(false);
    } catch (err: any) {
      alert("Error: " + (err.message || "Could not bulk approve"));
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackModal.item || !feedbackModal.feedbackText.trim()) return;
    setFeedbackModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/public/content-review/${projectId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_change",
          item_id: feedbackModal.item.id,
          feedback: feedbackModal.feedbackText.trim(),
          client_name: feedbackModal.clientName.trim() || project?.client_name || "Client"
        })
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      const newIssue = {
        id: `cli-${Date.now()}`,
        text: feedbackModal.feedbackText.trim(),
        author: feedbackModal.clientName.trim() || "Client",
        isClientIssue: true,
        timestamp: new Date().toISOString()
      };
      setItems(prev => prev.map(i => {
        if (i.id === feedbackModal.item?.id) {
          return {
            ...i,
            issues: [...(i.issues || []), newIssue]
          };
        }
        return i;
      }));
      if (previewModalItem?.id === feedbackModal.item.id) {
        setPreviewModalItem(prev => prev ? {
          ...prev,
          issues: [...(prev.issues || []), newIssue]
        } : null);
      }
      setFeedbackModal({
        isOpen: false,
        item: null,
        feedbackText: "",
        clientName: "",
        isSubmitting: false
      });
    } catch (err: any) {
      alert("Error: " + (err.message || "Could not submit feedback"));
      setFeedbackModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const copyCaption = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCaptionId(id);
    setTimeout(() => setCopiedCaptionId(null), 2000);
  };

  const copyReferenceLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedRefId(id);
    setTimeout(() => setCopiedRefId(null), 2000);
  };

  const filteredItems = items.filter(item => {
    if (typeFilter !== "All" && item.type !== typeFilter) return false;
    return true;
  });

  const approvedCount = items.filter(i => i.status === "Approved" || i.status === "Published").length;
  const pendingCount = items.length - approvedCount;

  // Format month name (e.g. 2026-11 -> November 2026)
  const formatMonthLabel = (mStr: string) => {
    if (!mStr || mStr === "All") {
      const fallback = availableMonths[0] || "";
      if (!fallback) return "Select Month";
      mStr = fallback;
    }
    try {
      const parts = mStr.split("-");
      const y = Number(parts[0]) || new Date().getFullYear();
      const m = Number(parts[1]) || (new Date().getMonth() + 1);
      const date = new Date(y, m - 1, 1);
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return mStr;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 animate-spin">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">Loading Content Calendar...</h2>
        <p className="text-sm text-slate-500 mt-1">Preparing high-resolution previews, captions, and schedules</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Review Portal Link Invalid</h2>
        <p className="text-sm text-slate-500 max-w-md mt-2">{error || "Please check your link or contact the agency manager for an updated review link."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-24">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-emerald-500 flex items-center justify-center text-white font-black shadow-md shadow-primary/20 shrink-0 text-sm">
              CC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight">{project.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                  Client Portal
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {project.client_name ? `For ${project.client_name}` : "Content Approval & Scheduling"} 
                {project.company_name ? ` • ${project.company_name}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Custom Modern Dropdown for Month Switcher */}
            {availableMonths.length > 0 && (
              <div className="relative" ref={monthDropdownRef}>
                <button
                  type="button"
                  onClick={() => setMonthDropdownOpen(prev => !prev)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-bold">{formatMonthLabel(selectedMonth)}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200", monthDropdownOpen && "rotate-180")} />
                </button>

                {monthDropdownOpen && (
                  <div className="absolute right-0 sm:left-0 mt-2 z-50 min-w-[220px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 mb-1">
                      Select Review Month
                    </div>

                    {availableMonths.map(m => {
                      const isSelected = selectedMonth === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            handleMonthChange(m);
                            setMonthDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer text-left",
                            isSelected
                              ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary font-black"
                              : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                          )}
                        >
                          <span>{formatMonthLabel(m)}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* View Switcher: Cards View vs Wall Calendar */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  viewMode === "cards" 
                    ? "bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Cards View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  viewMode === "calendar" 
                    ? "bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white" 
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Wall Calendar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Deliverables</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black">{items.length}</span>
              <span className="text-xs text-slate-400 font-medium">scheduled</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">Approved Posts</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">{approvedCount}</span>
              <span className="text-xs text-emerald-600/80 font-bold">
                {items.length > 0 ? Math.round((approvedCount / items.length) * 100) : 0}% approved
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Pending Review</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">{pendingCount}</span>
              <span className="text-xs text-slate-400 font-medium">needs review</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider block mb-1">Active Cycle</span>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-black truncate">{formatMonthLabel(selectedMonth)}</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {["All", "Post", "Reel", "Story", "Carousel"].map(ft => (
              <button
                key={ft}
                type="button"
                onClick={() => setTypeFilter(ft)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                  typeFilter === ft
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {ft === "All" ? "All Formats" : ft}
                <span className="ml-1.5 opacity-60 text-[10px]">
                  {ft === "All" ? items.length : items.filter(i => i.type === ft).length}
                </span>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900 dark:text-white">{filteredItems.length}</strong> items for {formatMonthLabel(selectedMonth)}
          </p>
        </div>

        {/* ==================== CARDS VIEW ==================== */}
        {viewMode === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item, idx) => {
              const assets = extractMediaAssets(item);
              const isApproved = item.status === "Approved" || item.status === "Published";
              const issueList = item.issues || [];
              const isCaptionExpanded = !!expandedCaptions[item.id];

              return (
                <div 
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-300 flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[11px] font-bold border",
                        item.type === "Reel" ? "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800" :
                        item.type === "Post" ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800" :
                        item.type === "Carousel" ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800" :
                        "bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-950/40 dark:border-pink-800"
                      )}>
                        {item.type === "Reel" ? "🎥 Reel" : item.type === "Post" ? "📸 Post" : item.type === "Carousel" ? "🎠 Carousel" : "📱 Story"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span>{item.posting_date || "TBD"}</span>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                        isApproved 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800" 
                          : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800"
                      )}>
                        {isApproved ? "Approved ✓" : "Pending"}
                      </span>
                    </div>
                  </div>

                  {/* Media / Visual Box (Interactive Gallery with Video/Images/Drive Previews) */}
                  <DeliverableMediaGallery
                    item={item}
                    assets={assets}
                    onOpenPreview={() => setPreviewModalItem(item)}
                  />

                  {/* Content Info */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-3.5">
                      <h3 className="font-black text-base text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                        {item.topic || "Untitled Post Idea"}
                      </h3>

                      {/* Caption Box with Copy & Expand / Read More */}
                      {item.caption ? (
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 relative group space-y-2">
                          <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-700/50 pb-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                              Post Caption / Copy
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => copyCaption(item.caption, item.id)}
                                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                title="Copy full caption"
                              >
                                {copiedCaptionId === item.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500" />
                                    <span className="text-emerald-500">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setFullCaptionModalItem(item)}
                                className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:text-primary dark:hover:text-primary shadow-2xs transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                title="View full caption"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Full View</span>
                              </button>
                            </div>
                          </div>

                          <p className={cn(
                            "whitespace-pre-line leading-relaxed font-normal text-slate-700 dark:text-slate-200 text-xs",
                            !isCaptionExpanded && "line-clamp-4"
                          )}>
                            {item.caption}
                          </p>

                          {item.caption.length > 120 && (
                            <div className="pt-0.5 flex justify-start">
                              <button
                                type="button"
                                onClick={() => setExpandedCaptions(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                              >
                                {isCaptionExpanded ? "Show Less ▴" : "Read More ▾"}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No caption drafted yet.</p>
                      )}

                      {/* Reference / Inspiration Link & Notes Box */}
                      <ReferenceSection
                        item={item}
                        onCopyRef={copyReferenceLink}
                        copiedRefId={copiedRefId}
                      />

                      {/* Client Issue/Remark Preview */}
                      {issueList.length > 0 && (
                        <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl space-y-1">
                          <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Feedback Notes:
                          </span>
                          {issueList.map((iss, iIdx) => (
                            <p key={iIdx} className="text-xs text-amber-900 dark:text-amber-200 pl-3 border-l-2 border-amber-400">
                              "{typeof iss === "object" ? iss.text : iss}"
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons for Client Approval & Changes (Temporarily commented out per request) */}
                    {/*
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      {isApproved ? (
                        <div className="flex-1 py-2 px-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Approved by Client</span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApproveItem(item)}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFeedbackModal({
                              isOpen: true,
                              item,
                              feedbackText: "",
                              clientName: project.client_name || "",
                              isSubmitting: false
                            })}
                            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Changes</span>
                          </button>
                        </>
                      )}
                    </div>
                    */}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ==================== WALL CALENDAR VIEW ==================== */}
        {viewMode === "calendar" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm overflow-hidden space-y-4">
            {/* Calendar Header with Navigation */}
            {(() => {
              const ym = selectedMonth && selectedMonth !== "All" ? selectedMonth : (availableMonths[0] || new Date().toISOString().slice(0, 7));
              const parts = ym.split("-");
              const yearNum = Number(parts[0]) || new Date().getFullYear();
              const monthNum = Number(parts[1]) || (new Date().getMonth() + 1);
              const firstDayOfWeek = new Date(yearNum, monthNum - 1, 1).getDay();
              const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
              const currentMonthLabel = new Date(yearNum, monthNum - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

              const paddingCells = Array.from({ length: firstDayOfWeek });
              const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

              return (
                <div className="space-y-4">
                  {/* Calendar Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                          {currentMonthLabel}
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                          Click any scheduled deliverable card to preview caption, media, reference link, and approve
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 shadow-2xs transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Prev</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMonthChange(new Date().toISOString().slice(0, 7))}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 shadow-2xs transition-all cursor-pointer text-xs font-bold"
                      >
                        Today
                      </button>

                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 shadow-2xs transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="Next Month"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 gap-2 text-center">
                    {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, dIdx) => (
                      <div 
                        key={day} 
                        className={cn(
                          "py-2.5 text-[11px] font-black uppercase tracking-wider rounded-xl border border-slate-200/50 dark:border-slate-800/50",
                          dIdx === 0 || dIdx === 6 
                            ? "bg-amber-50/60 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400" 
                            : "bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300"
                        )}
                      >
                        <span className="hidden md:inline">{day}</span>
                        <span className="md:hidden">{day.slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Monthly Dates Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {/* Padding cells before the 1st */}
                    {paddingCells.map((_, pIdx) => (
                      <div 
                        key={`pad-${pIdx}`} 
                        className="min-h-[135px] bg-slate-50/40 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200/50 dark:border-slate-800/50" 
                      />
                    ))}

                    {/* Month Days */}
                    {monthDays.map(day => {
                      const dateStr = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const dayItems = filteredItems.filter(i => i.posting_date === dateStr);
                      const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                      const dayOfWeek = new Date(yearNum, monthNum - 1, day).getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      return (
                        <div 
                          key={dateStr}
                          className={cn(
                            "min-h-[140px] p-2.5 rounded-2xl border flex flex-col justify-between transition-all",
                            isToday 
                              ? "border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10 shadow-xs" 
                              : dayItems.length > 0 
                                ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700" 
                                : isWeekend 
                                  ? "border-dashed border-slate-200 dark:border-slate-800/60 bg-amber-50/20 dark:bg-amber-950/10" 
                                  : "border-dashed border-slate-200 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/20"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                              isToday 
                                ? "bg-primary text-white shadow-xs" 
                                : isWeekend 
                                  ? "text-amber-600 dark:text-amber-400 font-bold" 
                                  : "text-slate-700 dark:text-slate-300"
                            )}>
                              {day}
                            </span>
                            {dayItems.length > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
                                {dayItems.length} post{dayItems.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>

                          {/* Day Deliverables List */}
                          <div className="space-y-1.5 flex-1">
                            {dayItems.map(dItem => {
                              const isApproved = dItem.status === "Approved" || dItem.status === "Published";
                              return (
                                <button
                                  type="button"
                                  key={dItem.id}
                                  onClick={() => setPreviewModalItem(dItem)}
                                  className={cn(
                                    "w-full text-left p-2 rounded-xl text-[11px] font-bold border transition-all space-y-1 shadow-2xs hover:scale-[1.02] cursor-pointer group",
                                    isApproved 
                                      ? "bg-emerald-50/90 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 hover:bg-emerald-100" 
                                      : "bg-amber-50/90 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 hover:bg-amber-100"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="truncate flex items-center gap-1">
                                      {dItem.type === "Reel" ? "🎥 Reel" : dItem.type === "Post" ? "📸 Post" : dItem.type === "Carousel" ? "🎠 Carousel" : "📱 Story"}
                                    </span>
                                    {isApproved ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                    )}
                                  </div>
                                  <p className="line-clamp-2 text-[10px] font-medium leading-tight opacity-90 group-hover:opacity-100">
                                    {dItem.topic}
                                  </p>
                                  {dItem.reference_link && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] text-primary font-bold">
                                      <Link2 className="w-2.5 h-2.5" /> Reference attached
                                    </span>
                                  )}
                                </button>
                              );
                            })}

                            {dayItems.length === 0 && (
                              <div className="h-full flex items-center justify-center py-4">
                                <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600">—</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* ==================== DELIVERABLE QUICK PREVIEW MODAL (CALENDAR / CARDS) ==================== */}
      {previewModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold border",
                  previewModalItem.type === "Reel" ? "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/40" :
                  previewModalItem.type === "Post" ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40" :
                  previewModalItem.type === "Carousel" ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40" :
                  "bg-pink-50 text-pink-600 border-pink-200 dark:bg-pink-950/40"
                )}>
                  {previewModalItem.type}
                </span>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {previewModalItem.posting_date}
                </span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                  (previewModalItem.status === "Approved" || previewModalItem.status === "Published")
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                )}>
                  {previewModalItem.status === "Approved" || previewModalItem.status === "Published" ? "Approved ✓" : "Pending Review"}
                </span>
              </div>

              <button 
                type="button"
                onClick={() => setPreviewModalItem(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Gallery in Modal */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <DeliverableMediaGallery
                item={previewModalItem}
                assets={extractMediaAssets(previewModalItem)}
                onOpenPreview={() => {}}
              />
            </div>

            {/* Topic & Caption */}
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  Deliverable Topic
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                  {previewModalItem.topic}
                </h3>
              </div>

              {/* Full Caption with Copy */}
              {previewModalItem.caption && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                      Complete Caption / Copy
                    </span>
                    <button
                      type="button"
                      onClick={() => copyCaption(previewModalItem.caption, previewModalItem.id)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                    >
                      {copiedCaptionId === previewModalItem.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Caption</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="whitespace-pre-line text-xs font-normal text-slate-700 dark:text-slate-200 leading-relaxed max-h-48 overflow-y-auto">
                    {previewModalItem.caption}
                  </p>
                </div>
              )}

              {/* Reference Link & Notes Section */}
              <ReferenceSection
                item={previewModalItem}
                onCopyRef={copyReferenceLink}
                copiedRefId={copiedRefId}
              />
            </div>

            {/* Modal Actions (Temporarily commented out per request) */}
            {/*
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              {previewModalItem.status === "Approved" || previewModalItem.status === "Published" ? (
                <div className="py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approved by Client</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const item = previewModalItem;
                      setPreviewModalItem(null);
                      setFeedbackModal({
                        isOpen: true,
                        item,
                        feedbackText: "",
                        clientName: project.client_name || "",
                        isSubmitting: false
                      });
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Request Changes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveItem(previewModalItem)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Approve Deliverable</span>
                  </button>
                </>
              )}
            </div>
            */}
          </div>
        </div>
      )}

      {/* ==================== FULL CAPTION READER MODAL ==================== */}
      {fullCaptionModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  📝
                </div>
                <div>
                  <h3 className="font-black text-sm">Full Post Caption</h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-xs">{fullCaptionModalItem.topic}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setFullCaptionModalItem(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 flex-1 overflow-y-auto space-y-3">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="whitespace-pre-line text-xs font-normal text-slate-800 dark:text-slate-100 leading-relaxed font-sans select-text">
                  {fullCaptionModalItem.caption}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                {fullCaptionModalItem.caption.length} characters
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyCaption(fullCaptionModalItem.caption, fullCaptionModalItem.id)}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {copiedCaptionId === fullCaptionModalItem.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Caption</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setFullCaptionModalItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== REQUEST CHANGES FEEDBACK DIALOG ==================== */}
      {feedbackModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  ✍️
                </div>
                <div>
                  <h3 className="font-black text-base">Request Changes</h3>
                  <p className="text-xs text-slate-500">Feedback will be directly assigned to creative team</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Deliverable:
                </label>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {feedbackModal.item?.topic} ({feedbackModal.item?.type})
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Your Name:
                </label>
                <input 
                  type="text" 
                  value={feedbackModal.clientName}
                  onChange={(e) => setFeedbackModal(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Change Details / Remarks: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={feedbackModal.feedbackText}
                  onChange={(e) => setFeedbackModal(prev => ({ ...prev, feedbackText: e.target.value }))}
                  placeholder="Explain what changes you would like in the visual, video, or caption..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setFeedbackModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={feedbackModal.isSubmitting || !feedbackModal.feedbackText.trim()}
                onClick={handleSubmitFeedback}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{feedbackModal.isSubmitting ? "Submitting..." : "Submit Feedback"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BULK APPROVE CONFIRMATION DIALOG ==================== */}
      {isBulkApproveOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto text-2xl font-black">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Approve Entire Month?</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                This will set all {items.length} deliverables in {formatMonthLabel(selectedMonth)} to <strong className="text-emerald-600">Approved</strong> status in the agency HRMS.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkApproveOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkSubmitting}
                onClick={handleBulkApprove}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                {isBulkSubmitting ? "Approving..." : "Yes, Approve All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
