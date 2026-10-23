import React, { useState } from "react";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Instagram } from "lucide-react";
import type { SocialAccount, SocialKeyword } from "../types";
import { SocialDropdown } from "../components/SocialDropdown";

interface CsvImportModalProps {
  isOpen: boolean;
  accounts: SocialAccount[];
  selectedAccountId?: string | undefined;
  onClose: () => void;
  onImport: (keywords: Partial<SocialKeyword>[]) => Promise<number>;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  accounts,
  selectedAccountId,
  onClose,
  onImport,
}) => {
  const [igAccountId, setIgAccountId] = useState(selectedAccountId || (accounts[0]?.ig_account_id ?? ""));
  const [csvText, setCsvText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; error?: string } | null>(null);

  if (!isOpen) return null;

  const parseCsv = (text: string): Partial<SocialKeyword>[] => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length <= 1) return [];

    const headers = lines[0]?.toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, "")) || [];
    const items: Partial<SocialKeyword>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      // Simple CSV split (handles standard commas)
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });

      const kw = row["keyword"] || row["trigger"] || "";
      const msg = row["message"] || row["dm_message"] || row["reply"] || "";
      if (kw && msg) {
        items.push({
          ig_account_id: igAccountId,
          keyword: kw,
          message: msg,
          comment_reply1: row["comment_reply1"] || row["reply1"] || "Check your DM 📩",
          comment_reply2: row["comment_reply2"] || row["reply2"] || undefined,
          comment_reply3: row["comment_reply3"] || row["reply3"] || undefined,
          require_follow: row["require_follow"] ? row["require_follow"].toLowerCase() !== "false" : true,
          scope: (row["scope"]?.toUpperCase() === "SPECIFIC_POSTS" ? "SPECIFIC_POSTS" : "ALL_POSTS"),
          media_id: row["media_id"] || undefined,
          desc: row["desc"] || row["description"] || `Imported ${kw}`,
        });
      }
    }
    return items;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result as string || "");
    };
    reader.readAsText(file);
  };

  const handleRunImport = async () => {
    if (!igAccountId) return;
    const parsed = parseCsv(csvText);
    if (parsed.length === 0) {
      setResult({ imported: 0, error: "No valid keyword rows found in CSV" });
      return;
    }

    try {
      setIsImporting(true);
      const count = await onImport(parsed);
      setResult({ imported: count });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setResult({
        imported: 0,
        error: err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const previewCount = parseCsv(csvText).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Import Keywords from CSV</h3>
              <p className="text-[11px] text-muted-foreground">Bulk upload comment-to-DM automation rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Assign to Instagram Account
            </label>
            <SocialDropdown
              value={igAccountId}
              onChange={setIgAccountId}
              label="Account"
              placeholder="Select Instagram Account"
              icon={<Instagram className="w-3.5 h-3.5 text-pink-500" />}
              fullWidth
              options={accounts.map((a) => ({
                value: a.ig_account_id,
                label: `@${a.username}`,
                subLabel: `ID: ${a.ig_account_id}`,
                icon: <Instagram className="w-3.5 h-3.5 text-pink-500" />,
              }))}
            />
          </div>

          <div className="p-4 border-2 border-dashed border-border rounded-xl text-center hover:bg-muted/30 transition-colors">
            <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
            <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
              Choose CSV File
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <p className="text-[10px] text-muted-foreground mt-1">or paste CSV raw text below</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-muted-foreground">CSV Raw Content</label>
              {previewCount > 0 && (
                <span className="text-[11px] font-bold text-emerald-500">
                  {previewCount} valid rules detected
                </span>
              )}
            </div>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="keyword,message,comment_reply1&#10;PDF,Here is your free book!,Check your DM 📩"
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background font-mono text-[11px] resize-none outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {result && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                result.error
                  ? "bg-rose-500/10 border border-rose-500/20 text-rose-500"
                  : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
              }`}
            >
              {result.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{result.error || `Successfully imported ${result.imported} rules!`}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRunImport}
              disabled={isImporting || previewCount === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Import {previewCount > 0 ? `(${previewCount})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
