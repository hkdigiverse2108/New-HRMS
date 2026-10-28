import React, { useState } from "react";
import {
  Plus,
  Sparkles,
  Search,
  Filter,
  Play,
  FileSpreadsheet,
  RefreshCw,
  Globe,
  Film,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Edit2,
  Power,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { SocialAccount, SocialKeyword } from "../types";
import { KeywordFormModal } from "./KeywordFormModal";
import { TestMatchModal } from "./TestMatchModal";
import { CsvImportModal } from "./CsvImportModal";
import { SocialDropdown } from "../components/SocialDropdown";
import { DateRangeFilter } from "@/components/common/DateRangeFilter";
import { Instagram } from "lucide-react";

interface KeywordsTabProps {
  keywords: SocialKeyword[];
  accounts: SocialAccount[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onSyncKeywords?: () => Promise<{ ok: boolean; total_n8n: number; inserted: number; updated: number; pushed_to_n8n?: number }>;
  onCreateKeyword: (data: Partial<SocialKeyword>) => Promise<void>;
  onUpdateKeyword: (id: string, data: Partial<SocialKeyword>) => Promise<void>;
  onToggleKeyword: (id: string) => Promise<void>;
  onDeleteKeyword: (id: string) => Promise<void>;
  onTestMatch: (data: { comment_text: string; media_id?: string | undefined }) => Promise<{
    matched: boolean;
    reason: string;
    normalized_comment: string;
    matched_rule?: SocialKeyword | null;
  }>;
}

export const KeywordsTab: React.FC<KeywordsTabProps> = ({
  keywords,
  accounts,
  isLoading,
  onRefresh,
  onSyncKeywords,
  onCreateKeyword,
  onUpdateKeyword,
  onToggleKeyword,
  onDeleteKeyword,
  onTestMatch,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [scopeFilter, setScopeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<SocialKeyword | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SocialKeyword | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const safeKeywords = Array.isArray(keywords) ? keywords : [];
  const filtered = safeKeywords.filter((k) => {
    if (selectedAccountId && k.ig_account_id !== selectedAccountId) return false;
    if (scopeFilter !== "ALL" && k.scope !== scopeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchKw = (k.keyword || "").toLowerCase().includes(q) || (k.keyword_norm || "").toLowerCase().includes(q);
      const matchMsg = (k.message || "").toLowerCase().includes(q);
      const matchDesc = (k.desc || "").toLowerCase().includes(q);
      if (!matchKw && !matchMsg && !matchDesc) return false;
    }
    if (dateRange?.from) {
      const kDate = new Date(k.created_at || k.updated_at || Date.now());
      const f = new Date(dateRange.from);
      f.setHours(0, 0, 0, 0);
      if (kDate < f) return false;
    }
    if (dateRange?.to) {
      const kDate = new Date(k.created_at || k.updated_at || Date.now());
      const t = new Date(dateRange.to);
      t.setHours(23, 59, 59, 999);
      if (kDate > t) return false;
    }
    return true;
  });

  const totalRules = safeKeywords.length;
  const activeRules = safeKeywords.filter((k) => k.is_active).length;
  const followGateCount = safeKeywords.filter((k) => k.require_follow).length;
  const specificCount = safeKeywords.filter((k) => k.scope === "SPECIFIC_POSTS").length;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await onDeleteKeyword(deleteTarget.id);
      await onRefresh();
      setDeleteTarget(null);
    } catch (err: any) {
      console.error("Failed to delete keyword rule:", err);
      setDeleteError(err?.message || "Failed to delete keyword rule. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkImport = async (rules: Partial<SocialKeyword>[]) => {
    let count = 0;
    for (const r of rules) {
      try {
        await onCreateKeyword(r);
        count++;
      } catch (e) {
        console.error("Failed to import rule:", e);
      }
    }
    await onRefresh();
    return count;
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      if (onSyncKeywords) {
        await onSyncKeywords();
      } else {
        await onRefresh();
      }
    } catch (e) {
      console.error("Failed to sync n8n keywords:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Total Rules
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">{totalRules}</div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Active Rules
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500">{activeRules}</div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Follow-Gated
          </div>
          <div className="mt-2 text-2xl font-black text-purple-500">{followGateCount}</div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Reel-Specific
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-500">{specificCount}</div>
        </div>
      </div>

      {/* Control Strip */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Account Filter */}
          <SocialDropdown
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            label="Account"
            placeholder="All Connected Accounts"
            icon={<Instagram className="w-3.5 h-3.5 text-pink-500" />}
            options={[
              { value: "", label: "All Connected Accounts" },
              ...accounts.map((a) => ({
                value: a.ig_account_id,
                label: `@${a.username}`,
                subLabel: `ID: ${a.ig_account_id}`,
                icon: <Instagram className="w-3.5 h-3.5 text-pink-500" />,
              })),
            ]}
          />

          {/* Scope Filter */}
          <SocialDropdown
            value={scopeFilter}
            onChange={setScopeFilter}
            label="Scope"
            placeholder="All Scopes"
            icon={<Filter className="w-3.5 h-3.5" />}
            options={[
              { value: "ALL", label: "All Scopes" },
              {
                value: "ALL_POSTS",
                label: "Global (All Posts)",
                icon: <Globe className="w-3.5 h-3.5 text-blue-500" />,
              },
              {
                value: "SPECIFIC_POSTS",
                label: "Post-Specific",
                icon: <Film className="w-3.5 h-3.5 text-purple-500" />,
              },
            ]}
          />

          {/* Date Range Filter */}
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            placeholder="Filter by Date"
            className="h-9"
          />

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter keywords, messages..."
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onRefresh()}
            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleSync}
            disabled={isSyncing || isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            title="Sync bidirectionally with live n8n Data Table"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing n8n..." : "Sync n8n"}
          </button>

          <button
            onClick={() => setIsTestModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Simulator
          </button>

          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Import CSV
          </button>

          <button
            onClick={() => {
              setEditingKeyword(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Rule
          </button>
        </div>
      </div>

      {/* Keywords Cards Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">No Keyword Rules Found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Create automated triggers for words like "PDF", "PRICE", or "LINK" to send instant private DMs and public replies.
          </p>
          <button
            onClick={() => {
              setEditingKeyword(null);
              setIsFormModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((k) => {
            const acct = accounts.find((a) => a.ig_account_id === k.ig_account_id);

            return (
              <div
                key={k.id}
                className="group relative p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-black text-sm tracking-wide">
                        {k.keyword}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                        norm: {k.keyword_norm}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {k.require_follow && (
                        <span
                          className="p-1 rounded-lg bg-purple-500/10 text-purple-500"
                          title="Follow-Gate Enabled"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          k.is_active
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {k.is_active ? "Active" : "Paused"}
                      </span>
                    </div>
                  </div>

                  {/* Account & Scope */}
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span className="font-semibold text-foreground">
                      @{acct?.username || k.ig_account_id}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {k.scope === "SPECIFIC_POSTS" ? (
                        <>
                          <Film className="w-3 h-3 text-indigo-500" />
                          <span>Reel {k.media_id ? `#${k.media_id.slice(-6)}` : "Specific"}</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3 text-emerald-500" />
                          <span>All Posts</span>
                        </>
                      )}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-foreground">
                      {k.hit_count} {k.hit_count === 1 ? "trigger" : "triggers"}
                    </span>
                  </div>

                  {/* Description */}
                  {k.desc && (
                    <p className="mt-2 text-xs text-foreground font-medium line-clamp-1">
                      {k.desc}
                    </p>
                  )}

                  {/* Message Preview */}
                  <div className="mt-3 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Private DM:
                    </div>
                    <p className="text-foreground line-clamp-2 leading-relaxed text-[11px]">
                      {k.message}
                    </p>
                  </div>

                  {/* Public Replies Preview */}
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Public Reply: </span>
                    <span className="italic">"{k.comment_reply1}"</span>
                    {(k.comment_reply2 || k.comment_reply3) && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        (+{(k.comment_reply2 ? 1 : 0) + (k.comment_reply3 ? 1 : 0)} variants)
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <button
                    onClick={() => onToggleKeyword(k.id)}
                    className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                      k.is_active ? "text-emerald-500 hover:text-emerald-600" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {k.is_active ? "Enabled" : "Disabled"}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingKeyword(k);
                        setIsFormModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Edit Rule"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(k);
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete Rule"
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

      {/* Form Modal */}
      <KeywordFormModal
        isOpen={isFormModalOpen}
        keyword={editingKeyword}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingKeyword(null);
        }}
        onSave={async (data) => {
          if (editingKeyword) {
            await onUpdateKeyword(editingKeyword.id, data);
          } else {
            await onCreateKeyword(data);
          }
          await onRefresh();
        }}
      />

      {/* Simulator Modal */}
      <TestMatchModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        onTestMatch={onTestMatch}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onClose={() => setIsCsvModalOpen(false)}
        onImport={handleBulkImport}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-card border border-border/80 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/25 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground">Delete Keyword Rule</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to delete this automation rule? This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  if (!isDeleting) setDeleteTarget(null);
                }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target details card */}
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary font-black text-xs tracking-wide">
                  #{deleteTarget.keyword}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  @{accounts.find((a) => a.ig_account_id === deleteTarget.ig_account_id || a.id === deleteTarget.ig_account_id)?.username || deleteTarget.username || deleteTarget.ig_account_id}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-medium">
                  {deleteTarget.scope === "SPECIFIC_POSTS" ? "Specific Reel/Post" : "All Posts"}
                </span>
              </div>

              {deleteTarget.desc && (
                <p className="text-xs text-foreground font-medium line-clamp-1">
                  {deleteTarget.desc}
                </p>
              )}

              {deleteTarget.message && (
                <div className="text-[11px] text-muted-foreground bg-background/60 p-2 rounded-lg border border-border/40">
                  <span className="font-semibold text-foreground/80">Private DM: </span>
                  <span className="italic line-clamp-2">"{deleteTarget.message}"</span>
                </div>
              )}
            </div>

            {/* Warning note */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Comments containing <strong>"{deleteTarget.keyword}"</strong> will no longer trigger automatic DMs or public replies on Instagram.
              </span>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
                {deleteError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Rule</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
