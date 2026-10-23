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
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<SocialKeyword | null>(null);

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

  const handleDelete = async (id: string, kw: string) => {
    if (confirm(`Delete rule for keyword "${kw}"?`)) {
      await onDeleteKeyword(id);
      await onRefresh();
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
                      onClick={() => handleDelete(k.id, k.keyword)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
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
    </div>
  );
};
