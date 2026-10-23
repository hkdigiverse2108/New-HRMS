import React, { useState } from "react";
import {
  MessageSquare,
  Sparkles,
  Copy,
  Check,
  Hash,
  Search,
  Image as ImageIcon,
  Loader2,
  Building2,
  HelpCircle,
} from "lucide-react";
import { SocialDropdown } from "../components/SocialDropdown";
import type { SocialBrand, CaptionGenerationResponse } from "../types";

interface CaptionsTabProps {
  brands: SocialBrand[];
  isLoading: boolean;
  onGenerateCaption: (data: {
    topic: string;
    brand_id?: string | null;
    image_url?: string | null;
  }) => Promise<CaptionGenerationResponse>;
}

export const CaptionsTab: React.FC<CaptionsTabProps> = ({
  brands,
  isLoading,
  onGenerateCaption,
}) => {
  const [topic, setTopic] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeAngle, setActiveAngle] = useState<"A" | "B" | "D">("A");
  const [captionResult, setCaptionResult] = useState<CaptionGenerationResponse | null>(null);

  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() && !imageUrl.trim()) return;
    setErrorMsg(null);

    try {
      setIsGenerating(true);
      const res = await onGenerateCaption({
        topic: topic.trim(),
        image_url: imageUrl.trim() || null,
        brand_id: selectedBrandId || null,
      });
      setCaptionResult(res);
      setActiveAngle("A");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Caption generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const getActiveCaptionText = () => {
    if (!captionResult) return "";
    const res = captionResult.result;
    if (activeAngle === "A") return res.angle_a_direct || "";
    if (activeAngle === "B") return res.angle_b_story || "";
    return res.angle_d_debate || "";
  };

  const handleCopyCaption = () => {
    const text = getActiveCaptionText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyHashtags = () => {
    if (!captionResult?.result?.hashtags?.full_set) return;
    navigator.clipboard.writeText(captionResult.result.hashtags.full_set);
    setCopiedHashtags(true);
    setTimeout(() => setCopiedHashtags(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Generator Form */}
      <div className="p-6 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-pink-500/5 shadow-md">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">AI Caption & SEO Studio</h3>
            <p className="text-xs text-muted-foreground">
              Generate 3 classified caption angles, SEO algorithmic search keywords & 3-tier curated hashtags
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Post Topic or Caption Objective
            </label>
            <textarea
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Announcing our new HRMS analytics dashboard update with 30-day free trial..."
              className="w-full px-4 py-2.5 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Image or Google Drive URL (Optional Multimodal Vision)
              </label>
              <div className="relative">
                <ImageIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/... or direct image URL"
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-border bg-background outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Brand Profile (Optional)
              </label>
              <SocialDropdown
                value={selectedBrandId}
                onChange={setSelectedBrandId}
                label="Brand"
                placeholder="No brand assigned"
                icon={<Building2 className="w-3.5 h-3.5 text-muted-foreground" />}
                fullWidth
                options={[
                  { value: "", label: "No brand assigned" },
                  ...brands.map((b) => ({
                    value: b.brand_id || b.id,
                    label: b.brand_name,
                    subLabel: b.industry || undefined,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isGenerating || (!topic.trim() && !imageUrl.trim())}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Captions & SEO...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Captions
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Section */}
      {captionResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: 3 Caption Angles */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              {/* Angles Tabs */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveAngle("A")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      activeAngle === "A"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Angle A: Direct Hook & Value
                  </button>
                  <button
                    onClick={() => setActiveAngle("B")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      activeAngle === "B"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Angle B: Story & Transformation
                  </button>
                  <button
                    onClick={() => setActiveAngle("D")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      activeAngle === "D"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Angle D: Debate & Engagement
                  </button>
                </div>

                <button
                  onClick={handleCopyCaption}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {copiedCaption ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCaption ? "Copied" : "Copy Caption"}
                </button>
              </div>

              {/* Caption Text Box */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border whitespace-pre-wrap text-xs text-foreground font-sans leading-relaxed">
                {getActiveCaptionText() || "No caption generated for this angle."}
              </div>

              {/* Accessibility Alt-Text */}
              {captionResult.result?.alt_text && (
                <div className="p-3.5 rounded-xl border border-border bg-card text-xs">
                  <span className="font-bold text-muted-foreground uppercase text-[10px] block mb-1">
                    Image Accessibility Alt-Text
                  </span>
                  <p className="text-foreground text-[11px] leading-relaxed">
                    {captionResult.result.alt_text}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: SEO Keywords & 3-Tier Hashtags */}
          <div className="space-y-4">
            {/* Algorithmic SEO Keywords */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Algorithmic SEO Keywords
                </h4>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(captionResult.result?.seo_keywords || []).map((kw, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-muted text-foreground text-xs font-medium"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            {/* 3-Tier Curated Hashtags */}
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-purple-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Curated Hashtags
                  </h4>
                </div>
                <button
                  onClick={handleCopyHashtags}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {copiedHashtags ? "Copied All!" : "Copy All"}
                </button>
              </div>

              {/* Tier Breakdown */}
              <div className="space-y-2 text-xs">
                <div>
                  <div className="text-[10px] font-bold text-emerald-500 uppercase">
                    High Volume (1M+)
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {(captionResult.result?.hashtags?.high_reach || []).join(" ") || "None"}
                  </p>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-indigo-500 uppercase">
                    Mid Volume (100k-1M)
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {(captionResult.result?.hashtags?.mid_reach || []).join(" ") || "None"}
                  </p>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-purple-500 uppercase">
                    Niche / Long-Tail (&lt;100k)
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {(captionResult.result?.hashtags?.long_tail || []).join(" ") || "None"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
