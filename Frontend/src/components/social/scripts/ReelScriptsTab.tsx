import React, { useState } from "react";
import {
  Film,
  Sparkles,
  Clock,
  Star,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Send,
  Loader2,
  ChevronRight,
  Eye,
  Trash2,
  CheckCircle2,
  Search,
  Filter,
} from "lucide-react";
import { SocialDropdown } from "../components/SocialDropdown";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import type { SocialBrand, SocialScript } from "../types";

interface ReelScriptsTabProps {
  scripts: SocialScript[];
  brands: SocialBrand[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onGenerateScript: (data: {
    topic: string;
    brand_id?: string | null;
    duration?: number;
    tone?: string;
  }) => Promise<SocialScript>;
  onReviseScript: (id: string, feedback: string) => Promise<SocialScript>;
  onToggleFavorite: (id: string) => Promise<void>;
  onUpdateStatus: (id: string, status: "draft" | "approved" | "recorded" | "published") => Promise<void>;
  onDeleteScript: (id: string) => Promise<void>;
}

// Defensive helper: safely extract string from strings, numbers, or LLM-produced objects (e.g. { text: "..." })
const toText = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (typeof val.text === "string") return val.text;
    if (typeof val.cta === "string") return val.cta;
    if (typeof val.action === "string") return val.action;
    if (typeof val.words === "string") return val.words;
    if (typeof val.spoken_words === "string") return val.spoken_words;
    if (typeof val.value === "string") return val.value;
    if (typeof val.notes === "string") return val.notes;
    if (typeof val.content === "string") return val.content;
    if (typeof val.message === "string") return val.message;
    if (Array.isArray(val)) return val.map(toText).filter(Boolean).join(", ");
    try {
      const parts = Object.values(val).map(toText).filter(Boolean);
      if (parts.length > 0) return parts.join(" ");
    } catch {
      // fallback
    }
  }
  return String(val);
};

export const ReelScriptsTab: React.FC<ReelScriptsTabProps> = ({
  scripts,
  brands,
  isLoading,
  onRefresh,
  onGenerateScript,
  onReviseScript,
  onToggleFavorite,
  onUpdateStatus,
  onDeleteScript,
}) => {
  const [activeScript, setActiveScript] = useState<SocialScript | null>(scripts[0] || null);
  const [topic, setTopic] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [duration, setDuration] = useState<number>(60);
  const [tone, setTone] = useState("Energetic & Relatable");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Library filters
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryStatusFilter, setLibraryStatusFilter] = useState("ALL");
  const [libraryDateRange, setLibraryDateRange] = useState<{ from?: Date; to?: Date } | undefined>();

  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [isRevising, setIsRevising] = useState(false);
  const [selectedHookIndex, setSelectedHookIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const filteredScripts = scripts.filter((s) => {
    if (libraryStatusFilter && libraryStatusFilter !== "ALL" && s.status !== libraryStatusFilter) return false;
    if (librarySearch) {
      const q = librarySearch.toLowerCase();
      const matchTitle = (s.title || "").toLowerCase().includes(q);
      const matchTopic = (s.topic || "").toLowerCase().includes(q);
      const matchBrand = (s.brand_name || "").toLowerCase().includes(q);
      if (!matchTitle && !matchTopic && !matchBrand) return false;
    }
    if (libraryDateRange?.from) {
      const sDate = new Date(s.created_at || s.updated_at || Date.now());
      const f = new Date(libraryDateRange.from);
      f.setHours(0, 0, 0, 0);
      if (sDate < f) return false;
    }
    if (libraryDateRange?.to) {
      const sDate = new Date(s.created_at || s.updated_at || Date.now());
      const t = new Date(libraryDateRange.to);
      t.setHours(23, 59, 59, 999);
      if (sDate > t) return false;
    }
    return true;
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerateError(null);

    try {
      setIsGenerating(true);
      const generated = await onGenerateScript({
        topic: topic.trim(),
        brand_id: selectedBrandId || null,
        duration,
        tone,
      });
      setActiveScript(generated);
      setSelectedHookIndex(0);
      setTopic("");
      await onRefresh();
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate script");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevise = async () => {
    if (!activeScript || !revisionFeedback.trim()) return;

    try {
      setIsRevising(true);
      const updated = await onReviseScript(activeScript.id, revisionFeedback.trim());
      setActiveScript(updated);
      setRevisionFeedback("");
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Revision failed");
    } finally {
      setIsRevising(false);
    }
  };

  const handleCopyFormattedScript = () => {
    if (!activeScript) return;
    const hooks = Array.isArray(activeScript.hooks) ? activeScript.hooks : [];
    const hook = hooks[selectedHookIndex] || hooks[0];
    const scenes = Array.isArray(activeScript.scenes) ? activeScript.scenes : [];
    const ctas = Array.isArray(activeScript.ctas) ? activeScript.ctas.map(toText).filter(Boolean) : [];
    const text = `🎬 PROJECT: ${toText(activeScript.title) || toText(activeScript.topic)} (${activeScript.target_duration_sec || 60}s)
${activeScript.brand_name ? `BRAND: ${activeScript.brand_name}` : ""}

🪝 SELECTED OPENING HOOK:
Visual: ${toText(hook?.visual_action) || "Look at camera"}
Spoken: "${toText(hook?.spoken_words || (hook as any)?.text || (typeof hook === "string" ? hook : ""))}"
On-screen: [${toText(hook?.on_screen_text)}]

📜 SCENE BY SCENE:
${scenes
  .map(
    (s: any, idx: number) =>
      `Scene ${s?.scene_number || idx + 1} (${s?.duration_sec || 5}s):
Visual: ${toText(s?.visual_action)}
Narration: "${toText(s?.spoken_words || s?.text)}"
Text Overlay: [${toText(s?.on_screen_text)}]`
  )
  .join("\n\n")}

📣 CALL TO ACTION:
${ctas.map((c, i) => `${i + 1}. ${toText(c)}`).join("\n")}

💡 PRODUCTION NOTES:
${toText(activeScript.production_notes) || "None"}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Script Generator Input Card */}
      <div className="p-6 rounded-2xl border border-border bg-gradient-to-br from-card via-card to-purple-500/5 shadow-md">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">AI Viral Reel Scriptwriter</h3>
            <p className="text-xs text-muted-foreground">
              Direct-response scriptwriter with hooks, scene blocking, prompt injection defense & brand tone
            </p>
          </div>
        </div>

        {generateError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
            {generateError}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Video Topic or Angle
            </label>
            <textarea
              rows={2}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 3 fatal mistakes beginner investors make in real estate, or How to automate customer DMs on Instagram in 2026..."
              className="w-full px-4 py-2.5 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Target Brand (Optional)
              </label>
              <SocialDropdown
                value={selectedBrandId}
                onChange={setSelectedBrandId}
                label="Brand"
                placeholder="No brand assigned"
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

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Target Duration
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      duration === d
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                Tone of Voice
              </label>
              <SocialDropdown
                value={tone}
                onChange={setTone}
                label="Tone"
                placeholder="Select Tone"
                fullWidth
                options={[
                  { value: "Energetic & Relatable", label: "Energetic & Relatable" },
                  { value: "Authority & Thought Leader", label: "Authority & Thought Leader" },
                  { value: "Casual & Humorous", label: "Casual & Humorous" },
                  { value: "Urgent & Controversial", label: "Urgent & Controversial" },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isGenerating || !topic.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Writing Viral Script...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Script
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Main Two-Column Layout: Script Viewer + History Library */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Script Detailed Viewer */}
        <div className="lg:col-span-2 space-y-4">
          {activeScript ? (
            <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6">
              {/* Script Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-foreground">
                      {activeScript.title}
                    </h2>
                    <button
                      onClick={() => onToggleFavorite(activeScript.id)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-amber-500"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          activeScript.is_favorited ? "fill-amber-500 text-amber-500" : ""
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {activeScript.target_duration_sec}s
                    </span>
                    <span>•</span>
                    <span>Revision #{activeScript.revision_count}</span>
                    {activeScript.brand_name && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-purple-500">{activeScript.brand_name}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <SocialDropdown
                    value={activeScript.status}
                    onChange={(val) =>
                      onUpdateStatus(
                        activeScript.id,
                        val as "draft" | "approved" | "recorded" | "published"
                      )
                    }
                    placeholder="Status"
                    options={[
                      { value: "draft", label: "Draft" },
                      { value: "approved", label: "Approved" },
                      { value: "recorded", label: "Recorded" },
                      { value: "published", label: "Published" },
                    ]}
                  />

                  <button
                    onClick={handleCopyFormattedScript}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy Script"}
                  </button>
                </div>
              </div>

              {/* Hook Variants Carousel / Tabs */}
              {(() => {
                const safeHooks = Array.isArray(activeScript.hooks)
                  ? activeScript.hooks.map((h: any, idx: number) => {
                      if (typeof h === "string") {
                        return { hook_number: idx + 1, visual_action: "Camera direct angle", spoken_words: h, on_screen_text: "" };
                      }
                      return {
                        hook_number: h?.hook_number ?? idx + 1,
                        visual_action: toText(h?.visual_action || "Look at camera"),
                        spoken_words: toText(h?.spoken_words || h?.text || ""),
                        on_screen_text: toText(h?.on_screen_text || ""),
                      };
                    })
                  : [];
                const safeScenes = Array.isArray(activeScript.scenes)
                  ? activeScript.scenes.map((s: any, idx: number) => ({
                      scene_number: s?.scene_number ?? idx + 1,
                      duration_sec: s?.duration_sec ?? 5,
                      visual_action: toText(s?.visual_action || ""),
                      spoken_words: toText(s?.spoken_words || s?.text || ""),
                      on_screen_text: toText(s?.on_screen_text || ""),
                    }))
                  : [];
                const safeCtas = Array.isArray(activeScript.ctas)
                  ? activeScript.ctas.map((c: any) => toText(c)).filter(Boolean)
                  : [];
                const currentHook = safeHooks[selectedHookIndex] || safeHooks[0];

                return (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Viral Hook Angles (Select preferred)
                        </h4>
                        <span className="text-[11px] text-muted-foreground">
                          {safeHooks.length} variations
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {safeHooks.map((h, idx) => {
                          const isSelected = selectedHookIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedHookIndex(idx)}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? "border-primary bg-primary/10 shadow-sm"
                                  : "border-border bg-card/40 hover:bg-muted/40"
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-bold mb-1">
                                <span className={isSelected ? "text-primary" : "text-foreground"}>
                                  Hook #{idx + 1}
                                </span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                              </div>
                              <p className="text-[11px] text-foreground line-clamp-2 italic">
                                "{toText(h?.spoken_words)}"
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      {/* Expanded Selected Hook Preview */}
                      {currentHook && (
                        <div className="mt-3 p-3.5 rounded-xl bg-muted/40 border border-border text-xs space-y-1.5">
                          <div>
                            <span className="font-semibold text-muted-foreground">Visual Action: </span>
                            <span className="text-foreground">{toText(currentHook.visual_action) || "Look at camera"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-muted-foreground">Spoken: </span>
                            <span className="text-foreground font-bold">"{toText(currentHook.spoken_words)}"</span>
                          </div>
                          {currentHook.on_screen_text && (
                            <div>
                              <span className="font-semibold text-muted-foreground">Overlay Text: </span>
                              <span className="px-1.5 py-0.5 rounded bg-card border font-mono text-[10px]">
                                {toText(currentHook.on_screen_text)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scene Breakdown */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        Scene-by-Scene Breakdown
                      </h4>
                      <div className="space-y-3">
                        {safeScenes.length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                            {((activeScript as any).script_text || (activeScript as any).final_text) ? (
                              <div className="whitespace-pre-wrap font-sans text-xs text-foreground leading-relaxed">
                                {((activeScript as any).script_text || (activeScript as any).final_text)}
                              </div>
                            ) : (
                              "No scene breakdown specified for this script."
                            )}
                          </div>
                        ) : (
                          safeScenes.map((scene, idx) => (
                            <div
                              key={idx}
                              className="p-3.5 rounded-xl border border-border bg-card hover:bg-muted/10 transition-colors"
                            >
                              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                                <span className="text-foreground">Scene {scene.scene_number || idx + 1}</span>
                                <span className="font-mono text-muted-foreground text-[11px]">
                                  ~{scene.duration_sec || 5}s
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Visual / Action
                                  </div>
                                  <p className="text-foreground text-[11px] mt-0.5 leading-relaxed">
                                    {scene.visual_action}
                                  </p>
                                </div>
                                <div>
                                  <div className="text-[10px] uppercase font-bold text-muted-foreground">
                                    Narration / Dialogue
                                  </div>
                                  <p className="text-foreground text-[11px] font-medium mt-0.5 leading-relaxed italic">
                                    "{scene.spoken_words}"
                                  </p>
                                </div>
                              </div>
                              {scene.on_screen_text && (
                                <div className="mt-2 pt-2 border-t border-border/50 text-[11px]">
                                  <span className="text-muted-foreground">Text Overlay: </span>
                                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                    {scene.on_screen_text}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Call to Actions & Production Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="p-4 rounded-xl border border-border bg-muted/20">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          Call to Action Options
                        </h5>
                        <ul className="space-y-1.5 text-xs text-foreground">
                          {safeCtas.map((cta, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-primary font-bold">{i + 1}.</span>
                              <span>{toText(cta)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-xl border border-border bg-muted/20">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          Production Notes
                        </h5>
                        <p className="text-xs text-foreground leading-relaxed">
                          {toText(activeScript.production_notes) || "Use bright lighting, punchy B-roll cuts on every 2.5 seconds."}
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Revision Box */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <RotateCcw className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Request AI Revision
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={revisionFeedback}
                    onChange={(e) => setRevisionFeedback(e.target.value)}
                    placeholder="e.g. Make hook #2 punchier, shorten scene 3, add more humor..."
                    className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <button
                    onClick={handleRevise}
                    disabled={isRevising || !revisionFeedback.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {isRevising ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Revise
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40">
              <Film className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <h4 className="text-sm font-bold text-foreground">No Script Selected</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Generate a new script above or pick one from your library on the right.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Scripts Library */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Scripts Library ({filteredScripts.length})
            </h4>
          </div>

          {/* Library Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search scripts..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <SocialDropdown
                value={libraryStatusFilter}
                onChange={setLibraryStatusFilter}
                label="Status"
                placeholder="All Statuses"
                icon={<Filter className="w-3.5 h-3.5" />}
                className="flex-1"
                options={[
                  { value: "ALL", label: "All Statuses" },
                  { value: "draft", label: "Draft" },
                  { value: "approved", label: "Approved" },
                  { value: "recorded", label: "Recorded" },
                  { value: "published", label: "Published" },
                ]}
              />

              <DateRangeFilter
                value={libraryDateRange}
                onChange={setLibraryDateRange}
                placeholder="Date Range"
                className="h-9 flex-1"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
            {filteredScripts.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground rounded-xl border border-dashed border-border">
                No scripts match selected filters
              </div>
            ) : (
              filteredScripts.map((s) => {
              const isCurrent = activeScript?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setActiveScript(s);
                    setSelectedHookIndex(0);
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isCurrent
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-xs font-bold text-foreground line-clamp-1">
                      {s.title}
                    </h5>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(s.id);
                      }}
                      className="text-muted-foreground hover:text-amber-500"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          s.is_favorited ? "fill-amber-500 text-amber-500" : ""
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{s.target_duration_sec}s • Rev #{s.revision_count}</span>
                    <span className="capitalize font-medium text-foreground">{s.status}</span>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      </div>
    </div>
  );
};
