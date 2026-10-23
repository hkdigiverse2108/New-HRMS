import React, { useState } from "react";
import { X, Play, CheckCircle2, XCircle, Search, Loader2 } from "lucide-react";
import type { SocialKeyword } from "../types";

interface TestMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestMatch: (data: {
    comment_text: string;
    media_id?: string | undefined;
  }) => Promise<{
    matched: boolean;
    reason: string;
    normalized_comment: string;
    matched_rule?: SocialKeyword | null;
  }>;
}

export const TestMatchModal: React.FC<TestMatchModalProps> = ({
  isOpen,
  onClose,
  onTestMatch,
}) => {
  const [commentText, setCommentText] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<{
    matched: boolean;
    reason: string;
    normalized_comment: string;
    matched_rule?: SocialKeyword | null;
  } | null>(null);

  if (!isOpen) return null;

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setIsTesting(true);
      const res = await onTestMatch({
        comment_text: commentText.trim(),
        media_id: mediaId.trim() || undefined,
      });
      setResult(res);
    } catch (err: unknown) {
      setResult({
        matched: false,
        reason: err instanceof Error ? err.message : "Test failed",
        normalized_comment: "",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Play className="w-4 h-4 fill-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Rule Simulator</h3>
              <p className="text-[11px] text-muted-foreground">
                Test how incoming comments are matched against active rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleRunTest} className="mt-4 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Sample Comment Text
            </label>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="e.g. #PDF please or PRICE"
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Media / Reel ID (Optional)
            </label>
            <input
              type="text"
              value={mediaId}
              onChange={(e) => setMediaId(e.target.value)}
              placeholder="Leave empty for global test"
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isTesting || !commentText.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                Simulate Match
              </>
            )}
          </button>
        </form>

        {result && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs ${
              result.matched
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : "bg-amber-500/10 border-amber-500/20 text-amber-500"
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {result.matched ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{result.matched ? "Rule Matched!" : "No Match"}</span>
            </div>

            <p className="mt-2 text-foreground text-[11px]">{result.reason}</p>

            {result.normalized_comment && (
              <div className="mt-2 text-[10px] text-muted-foreground font-mono">
                Normalized string: <span className="font-bold">"{result.normalized_comment}"</span>
              </div>
            )}

            {result.matched_rule && (
              <div className="mt-3 p-3 rounded-lg bg-card/80 border border-border text-foreground space-y-1 text-[11px]">
                <div className="font-bold text-primary">Matched Keyword: {result.matched_rule.keyword}</div>
                <div className="text-muted-foreground truncate">DM: "{result.matched_rule.message}"</div>
                <div className="text-muted-foreground">Scope: {result.matched_rule.scope}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
