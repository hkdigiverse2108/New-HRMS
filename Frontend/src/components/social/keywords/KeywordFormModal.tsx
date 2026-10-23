import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Instagram,
  ShieldCheck,
  Link2,
  Loader2,
  Film,
  Image as ImageIcon,
  ExternalLink,
  Check,
  Search,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import type { SocialAccount, SocialKeyword, SocialMediaItem } from "../types";
import { SocialDropdown } from "../components/SocialDropdown";
import { useSocialApi } from "../useSocialApi";
import { cn } from "@/lib/utils";

interface KeywordFormModalProps {
  isOpen: boolean;
  keyword?: SocialKeyword | null | undefined;
  accounts: SocialAccount[];
  selectedAccountId?: string | undefined;
  onClose: () => void;
  onSave: (data: Partial<SocialKeyword>) => Promise<void>;
}

export const KeywordFormModal: React.FC<KeywordFormModalProps> = ({
  isOpen,
  keyword,
  accounts,
  selectedAccountId,
  onClose,
  onSave,
}) => {
  const api = useSocialApi();
  const [igAccountId, setIgAccountId] = useState("");
  const [keywordText, setKeywordText] = useState("");
  const [scope, setScope] = useState<"ALL_POSTS" | "SPECIFIC_POSTS">("ALL_POSTS");
  const [mediaId, setMediaId] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [message, setMessage] = useState("");
  const [commentReply1, setCommentReply1] = useState("Check your DM 📩");
  const [commentReply2, setCommentReply2] = useState("Just sent you a DM 📩");
  const [commentReply3, setCommentReply3] = useState("Sent! Have a look at your inbox 📩");
  const [requireFollow, setRequireFollow] = useState(true);
  const [desc, setDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reel & Post media items state
  const [mediaItems, setMediaItems] = useState<SocialMediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"ALL" | "REEL" | "POST">("ALL");
  const [showManualInputs, setShowManualInputs] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);

  // Initialize form state
  useEffect(() => {
    if (keyword) {
      setIgAccountId(keyword.ig_account_id || "");
      setKeywordText(keyword.keyword || "");
      setScope(keyword.scope || "ALL_POSTS");
      setMediaId(keyword.media_id || "");
      setMediaUrl(keyword.media_url || "");
      setMessage(keyword.message || "");
      setCommentReply1(keyword.comment_reply1 || "Check your DM 📩");
      setCommentReply2(keyword.comment_reply2 || "");
      setCommentReply3(keyword.comment_reply3 || "");
      setRequireFollow(keyword.require_follow ?? true);
      setDesc(keyword.desc || "");
      setShowManualInputs(Boolean(keyword.media_id && !keyword.media_url));
    } else {
      const defaultAcc = selectedAccountId || (accounts[0]?.ig_account_id ?? "");
      setIgAccountId(defaultAcc);
      setKeywordText("");
      setScope("ALL_POSTS");
      setMediaId("");
      setMediaUrl("");
      setMessage("");
      setCommentReply1("Check your DM 📩");
      setCommentReply2("Just sent you a DM 📩");
      setCommentReply3("Sent! Have a look at your inbox 📩");
      setRequireFollow(true);
      setDesc("");
      setShowManualInputs(false);
    }
    setFormError(null);
  }, [keyword, accounts, selectedAccountId, isOpen]);

  // Load account reels & posts dynamically (persisted in MongoDB, syncs live from Instagram)
  const loadAccountMedia = async (targetId: string, forceSync = false) => {
    if (!targetId) return;
    try {
      setLoadingMedia(true);
      if (forceSync) {
        try {
          await api.syncAccountMedia(targetId);
        } catch {
          // If live sync is not available (mock/dev), fallback gracefully
        }
      }
      const res = await api.getAccountMedia(targetId, 200);
      const safeItems = Array.isArray(res?.items) ? res.items : [];
      setMediaItems(safeItems);
      setVisibleCount(24);
    } catch (err) {
      console.error("Failed to load account reels and posts:", err);
    } finally {
      setLoadingMedia(false);
    }
  };

  useEffect(() => {
    if (isOpen && scope === "SPECIFIC_POSTS" && igAccountId) {
      loadAccountMedia(igAccountId);
    }
  }, [isOpen, scope, igAccountId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const kw = keywordText.trim();
    if (!kw) {
      setFormError("Trigger keyword is required");
      return;
    }
    if (!igAccountId) {
      setFormError("Please select a target Instagram account");
      return;
    }
    if (scope === "SPECIFIC_POSTS" && !mediaId.trim()) {
      setFormError("Please select a specific Reel or Post from the list, or enter a Media ID");
      return;
    }
    if (!message.trim()) {
      setFormError("Private DM message cannot be empty");
      return;
    }
    if (!commentReply1.trim()) {
      setFormError("At least one public comment reply variant is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const targetAccount = accounts.find((a) => a.ig_account_id === igAccountId || a.id === igAccountId);
      const accUsername = targetAccount?.username || "";

      await onSave({
        ig_account_id: igAccountId,
        username: accUsername,
        keyword: kw,
        scope,
        media_id: scope === "SPECIFIC_POSTS" ? mediaId.trim() : "",
        media_url: scope === "SPECIFIC_POSTS" ? mediaUrl.trim() : "",
        post_link: scope === "SPECIFIC_POSTS" ? mediaUrl.trim() : "",
        message: message.trim(),
        comment_reply1: commentReply1.trim(),
        comment_reply2: commentReply2.trim() || undefined,
        comment_reply3: commentReply3.trim() || undefined,
        require_follow: requireFollow,
        desc: desc.trim() || `Automation for ${kw}`,
      });
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save keyword rule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const normalizedPreview = keywordText
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toUpperCase();

  // Account dropdown options
  const accountOptions = accounts.map((a) => ({
    value: a.ig_account_id,
    label: `@${a.username}`,
    subLabel: `ID: ${a.ig_account_id}`,
    icon: <Instagram className="w-3.5 h-3.5 text-pink-500" />,
  }));

  // Filtered media items
  const filteredMedia = mediaItems.filter((item) => {
    if (mediaTypeFilter !== "ALL" && item.type !== mediaTypeFilter) return false;
    if (mediaSearch) {
      const q = mediaSearch.toLowerCase();
      const matchCaption = (item.caption || "").toLowerCase().includes(q);
      const matchCode = (item.shortcode || "").toLowerCase().includes(q);
      const matchId = (item.id || "").toLowerCase().includes(q);
      if (!matchCaption && !matchCode && !matchId) return false;
    }
    return true;
  });

  const selectedMediaItem = mediaItems.find((m) => m.id === mediaId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {keyword ? "Edit Automation Rule" : "Create Comment-to-DM Rule"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Trigger instant DMs and public replies when users comment this keyword
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 font-semibold">
              {formError}
            </div>
          )}

          {/* Account Selector (Upgraded with SocialDropdown) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Target Instagram Account
            </label>
            <SocialDropdown
              value={igAccountId}
              options={accountOptions}
              onChange={(val) => {
                setIgAccountId(val);
                setMediaId("");
                setMediaUrl("");
                if (scope === "SPECIFIC_POSTS") {
                  loadAccountMedia(val);
                }
              }}
              fullWidth
              placeholder="Select Instagram Account"
              icon={<Instagram className="w-3.5 h-3.5 text-pink-500" />}
            />
          </div>

          {/* Keyword and Normalized Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Trigger Keyword
              </label>
              <input
                type="text"
                value={keywordText}
                onChange={(e) => setKeywordText(e.target.value)}
                placeholder="e.g. PDF or PRICE or HIRE"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-semibold uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Exact Normalized Match
              </label>
              <div className="w-full px-3.5 py-2 text-xs rounded-xl border border-border bg-muted/50 font-mono text-muted-foreground flex items-center justify-between">
                <span>{normalizedPreview || "—"}</span>
                <span className="text-[10px] text-muted-foreground">NFKC / UPPER</span>
              </div>
            </div>
          </div>

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Reel / Post Scope
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("ALL_POSTS")}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer select-none",
                  scope === "ALL_POSTS"
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>All Reels & Posts</span>
                  {scope === "ALL_POSTS" && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">Triggers on any post from this account</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScope("SPECIFIC_POSTS");
                  if (igAccountId && mediaItems.length === 0) {
                    loadAccountMedia(igAccountId);
                  }
                }}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer select-none",
                  scope === "SPECIFIC_POSTS"
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>Specific Reel / Post</span>
                  {scope === "SPECIFIC_POSTS" && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">High priority rule for target content</div>
              </button>
            </div>
          </div>

          {/* Specific Reel / Post Selector - Requirement 1 Implementation */}
          {scope === "SPECIFIC_POSTS" && (
            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Select Reel or Post</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Choose which reel or post triggers this automation
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {mediaItems.length > 0 && (
                    <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
                      {filteredMedia.length} of {mediaItems.length} items
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => loadAccountMedia(igAccountId, true)}
                    disabled={loadingMedia}
                    title="Sync latest reels & posts from Instagram"
                    className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 text-[11px] font-medium"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", loadingMedia && "animate-spin text-primary")} />
                    <span className="hidden sm:inline">Sync Live</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualInputs(!showManualInputs)}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    {showManualInputs ? "Hide Manual ID" : "Manual ID Input"}
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => setMediaSearch(e.target.value)}
                    placeholder="Search reels & posts by caption or ID..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
                  />
                  {mediaSearch && (
                    <button
                      type="button"
                      onClick={() => setMediaSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Scope filter: ALL vs REEL vs POST */}
                <div className="flex items-center p-0.5 rounded-xl bg-card border border-border">
                  {(["ALL", "REEL", "POST"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setMediaTypeFilter(filter)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                        mediaTypeFilter === filter
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {filter === "ALL" ? "All" : filter === "REEL" ? "Reels" : "Posts"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media List */}
              {loadingMedia ? (
                <div className="p-8 text-center bg-card/60 rounded-xl border border-border">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Fetching reels and posts from Instagram...</p>
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="p-6 text-center bg-card/60 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground">
                    {mediaItems.length === 0
                      ? "No reels or posts found for this account. Use manual input below."
                      : "No matching reels or posts found for your search."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-84 overflow-y-auto pr-1 scrollbar-thin">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {filteredMedia.slice(0, visibleCount).map((item) => {
                        const isSelected = mediaId === item.id;
                        const isReel = item.type === "REEL";
                        const rawType = (item.media_type || "").toLowerCase().replace(/_/g, " ");
                        const badgeLabel = rawType === "carousel album" ? "carousel album" : (rawType === "video" || isReel) ? "video" : "image";
                        const thumbUrl = item.thumbnail_url || item.media_url || "";

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setMediaId(item.id);
                              setMediaUrl(item.permalink || "");
                            }}
                            title={item.caption || `Media ID: ${item.id}`}
                            className={cn(
                              "relative aspect-square rounded-2xl overflow-hidden border-2 cursor-pointer select-none group transition-all duration-200 shadow-2xs bg-muted/60",
                              isSelected
                                ? "border-primary ring-3 ring-primary/30 shadow-md scale-[1.02] z-10"
                                : "border-border/70 hover:border-primary/50 hover:shadow-sm"
                            )}
                          >
                            {/* Real Instagram Image Thumbnail with no-referrer so Meta CDN loads */}
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={item.caption || "Instagram media"}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted/80">
                                {isReel ? (
                                  <Film className="w-8 h-8 text-purple-500/60" />
                                ) : (
                                  <ImageIcon className="w-8 h-8 text-sky-500/60" />
                                )}
                              </div>
                            )}

                            {/* Instagram-style Bottom Center Badge (carousel album, video, image) */}
                            <div className="absolute inset-x-0 bottom-1.5 flex justify-center pointer-events-none z-10 px-1">
                              <span className="px-2.5 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-medium tracking-wide shadow-xs border border-white/10 lowercase truncate">
                                {badgeLabel}
                              </span>
                            </div>

                            {/* Selection Checkmark Badge on Top-Left */}
                            {isSelected && (
                              <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md ring-2 ring-background z-20 animate-in zoom-in-50 duration-150">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}

                            {/* Subtle Top-Right External Link on Hover */}
                            {item.permalink && (
                              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <a
                                  href={item.permalink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded-md bg-black/70 text-white hover:text-primary transition-colors flex items-center"
                                  title="Open on Instagram"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Load Older Posts Button matching ig-platform */}
                  {filteredMedia.length > visibleCount && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + 24)}
                        className="w-full py-2 px-4 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs hover:border-primary/50 flex items-center justify-center gap-2"
                      >
                        <span>Load older posts</span>
                        <span className="text-[11px] text-muted-foreground font-normal">
                          ({filteredMedia.length - visibleCount} more available)
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Selected Media Notification Bar */}
              {selectedMediaItem && (
                <div className="p-2.5 rounded-xl bg-card border border-primary/30 flex items-center justify-between text-xs shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {(selectedMediaItem.thumbnail_url || selectedMediaItem.media_url) && (
                      <img
                        src={selectedMediaItem.thumbnail_url || selectedMediaItem.media_url || ""}
                        alt="thumbnail"
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-lg object-cover shrink-0 border border-border"
                      />
                    )}
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase border flex items-center gap-1 shrink-0",
                        selectedMediaItem.type === "REEL"
                          ? "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30"
                          : "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30"
                      )}
                    >
                      {selectedMediaItem.type === "REEL" ? <Film className="w-2.5 h-2.5" /> : <ImageIcon className="w-2.5 h-2.5" />}
                      {selectedMediaItem.type}
                    </span>
                    <span className="font-semibold text-foreground truncate">
                      {selectedMediaItem.caption || `ID: ${selectedMediaItem.id}`}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                    ✓ Selected
                  </span>
                </div>
              )}

              {/* Manual ID / URL Override Section */}
              {showManualInputs && (
                <div className="pt-2 border-t border-border/80 space-y-2.5 animate-in fade-in duration-150">
                  <div className="text-[11px] font-bold text-foreground">
                    Manual Media ID & URL Override:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                        Media ID
                      </label>
                      <input
                        type="text"
                        value={mediaId}
                        onChange={(e) => setMediaId(e.target.value)}
                        placeholder="e.g. 18012345678901234"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                        Media URL (Optional reference)
                      </label>
                      <input
                        type="text"
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://www.instagram.com/reel/Cxxxxxx/"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Follow-Gate Switch */}
          <div className="p-3.5 rounded-xl border border-border bg-card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">Follow-Gate Protection</div>
                <div className="text-[11px] text-muted-foreground">
                  Check if commenter follows before sending final link; send "Follow to unlock" card if not
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={requireFollow}
                onChange={(e) => setRequireFollow(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Private DM Message */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Private DM Message Content
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hey! 👋 Here is the private guide you requested: https://example.com/guide Enjoy!"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Public Comment Replies (Rotating Variants) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground">
              Public Comment Replies (Rotated randomly to prevent Instagram spam flags)
            </label>
            <input
              type="text"
              value={commentReply1}
              onChange={(e) => setCommentReply1(e.target.value)}
              placeholder="Variant 1 (e.g. Check your DM 📩)"
              className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <input
              type="text"
              value={commentReply2}
              onChange={(e) => setCommentReply2(e.target.value)}
              placeholder="Variant 2 (Optional, e.g. Just sent it over to your inbox! 📩)"
              className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            />
            <input
              type="text"
              value={commentReply3}
              onChange={(e) => setCommentReply3(e.target.value)}
              placeholder="Variant 3 (Optional, e.g. Sent! Check your DMs 📩)"
              className="w-full px-3.5 py-1.5 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Internal Campaign / Rule Note
            </label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. Free Ebook Q3 Campaign"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
            />
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving Rule...
                </>
              ) : (
                "Save Automation Rule"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
