import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { useSales } from "./SalesContext";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BulkImportModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkImportModalProps) {
  const { fetchLeads } = useSales();
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        toast.error("File is empty or contains only a header");
        return;
      }

      const firstLine = lines[0];
      if (!firstLine) return;

      const headers = firstLine.split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i];
        if (!currentLine) continue;
        const values = currentLine.split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
        if (values.length < 2) continue;

        const row: any = {};
        headers.forEach((h, idx) => {
          const val = values[idx] || "";
          if (h.includes("company") || h.includes("name")) {
            row.company = row.company || val;
          }
          if (h.includes("contact") || h.includes("person")) {
            row.contact = val;
          }
          if (h.includes("phone") || h.includes("mobile")) {
            row.phone = val;
          }
          if (h.includes("email")) {
            row.email = val;
          }
          if (h.includes("category")) {
            row.category = val;
          }
          if (h.includes("source")) {
            row.source = val;
          }
          if (h.includes("city")) {
            row.city = val;
          }
          if (h.includes("state")) {
            row.state = val;
          }
          if (h.includes("budget") || h.includes("income") || h.includes("value")) {
            row.budget = parseFloat(val) || 0;
            row.expectedIncome = val;
          }
        });

        if (!row.contact && row.company) {
          row.contact = row.company;
        }
        if (!row.company && row.contact) {
          row.company = row.contact;
        }

        if (row.phone || row.contact || row.company) {
          row.stage = "Lead";
          row.status = "Lead";
          row.priority = "Medium";
          rows.push(row);
        }
      }

      setParsedRows(rows);
      toast.success(`Parsed ${rows.length} lead(s) from ${file.name}`);
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      toast.error("No valid leads to import");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/leads/bulk", parsedRows);
      toast.success(`Successfully imported ${parsedRows.length} leads!`);
      await fetchLeads();
      setParsedRows([]);
      setFileName("");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to import leads");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl bg-card border border-border p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">
            Import Leads from CSV
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Upload a CSV file containing company names, phone numbers, and contact details.
          </p>
        </DialogHeader>

        <div className="py-3 space-y-4">
          <label className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/30 transition-colors">
            <UploadCloud className="w-10 h-10 text-emerald-600" />
            <div className="text-center">
              <span className="text-sm font-bold text-foreground">
                {fileName ? fileName : "Click to select a CSV file"}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Supported columns: Company, Contact, Phone, Email, Category, Source, Budget
              </p>
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span>Preview ({parsedRows.length} rows detected)</span>
                <span className="text-emerald-600 font-semibold">Ready to import</span>
              </div>
              <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border/60 bg-muted/20 text-xs">
                {parsedRows.slice(0, 10).map((r, i) => (
                  <div key={i} className="p-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {r.company} <span className="text-muted-foreground">({r.contact})</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.phone} {r.email ? `· ${r.email}` : ""} {r.category ? `· ${r.category}` : ""}
                      </p>
                    </div>
                    {r.budget > 0 && (
                      <span className="font-bold text-emerald-600">₹{r.budget.toLocaleString()}</span>
                    )}
                  </div>
                ))}
                {parsedRows.length > 10 && (
                  <div className="p-2 text-center text-muted-foreground text-[11px] italic">
                    +{parsedRows.length - 10} more rows...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isSubmitting || parsedRows.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {isSubmitting ? "Importing..." : `Import ${parsedRows.length} Leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
