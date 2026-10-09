import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PenTool, UploadCloud, X, Check, Loader2, Eraser, Image as ImageIcon, Trash2, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface ChangeSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSignatureUrl?: string;
  userName: string;
  employeeId: string;
  onSignatureSaved: (newSignatureUrl: string) => void;
}

export function ChangeSignatureModal({
  isOpen,
  onClose,
  currentSignatureUrl,
  userName,
  employeeId,
  onSignatureSaved,
}: ChangeSignatureModalProps) {
  const [activeTab, setActiveTab] = useState<"draw" | "upload">("draw");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [existingSignature, setExistingSignature] = useState<string | null>(currentSignatureUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync existingSignature prop on modal open
  useEffect(() => {
    if (isOpen) {
      setExistingSignature(currentSignatureUrl || null);
      setSignatureData(null);
      setHasDrawn(false);
    }
  }, [isOpen, currentSignatureUrl]);

  // Initialize Canvas context
  useEffect(() => {
    if (isOpen && !existingSignature && activeTab === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#0f2552";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    }
  }, [isOpen, existingSignature, activeTab]);

  // Canvas Mouse / Touch Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL("image/png"));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setSignatureData(null);
  };

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG or JPG)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setSignatureData(result);
        setHasDrawn(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveExistingSignature = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`user_signature_${employeeId}`);
        localStorage.removeItem("user_signature_current");
      }

      try {
        await api.put(`/employees/${employeeId}`, {
          signature: "",
          signature_url: "",
          personal_info: { signature: "" },
        }, { showLoader: false, showErrorToast: false });
      } catch (e) {}

      setExistingSignature(null);
      setSignatureData(null);
      onSignatureSaved("");
      toast.success("Signature removed! You can now draw or upload a new signature.");
    } catch (err: any) {
      toast.error("Failed to remove signature");
    }
  };

  const handleSaveSignature = async () => {
    if (!signatureData) {
      toast.error("Please draw or upload a signature first");
      return;
    }

    setIsSaving(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(`user_signature_${employeeId}`, signatureData);
        localStorage.setItem("user_signature_current", signatureData);
      }

      try {
        await api.put(`/employees/${employeeId}`, {
          signature: signatureData,
          signature_url: signatureData,
          personal_info: { signature: signatureData },
        }, { showLoader: false, showErrorToast: false });
      } catch (err) {
        console.warn("Backend signature sync fallback to local storage:", err);
      }

      onSignatureSaved(signatureData);
      toast.success("New signature saved successfully!");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save signature");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-3xl border border-border/60 shadow-2xl bg-background [&>button]:hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-foreground">Digital Signature</h3>
              <p className="text-xs text-muted-foreground">Add or update your official signature for documents</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 border border-border/60 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {existingSignature ? (
            /* IF SIGNATURE ALREADY EXISTS: Show Existing Signature Box & Remove Button */
            <div className="space-y-4 text-center">
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                  Current Saved Signature
                </span>
                <div className="p-3 bg-white rounded-xl border border-slate-200 max-w-sm mx-auto shadow-xs">
                  <img src={existingSignature} alt="Current Signature" className="max-h-24 object-contain mx-auto" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  To draw or upload a new signature, please remove your existing signature first.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRemoveExistingSignature}
                className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <Trash2 className="w-4 h-4" /> Remove Signature to Add New One
              </button>
            </div>
          ) : (
            /* IF NO EXISTING SIGNATURE: Show Draw / Upload Tabs */
            <>
              {/* Tab Selection */}
              <div className="flex p-1 bg-muted/60 rounded-2xl text-xs font-bold border border-border/40">
                <button
                  type="button"
                  onClick={() => setActiveTab("draw")}
                  className={cn(
                    "flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-2",
                    activeTab === "draw"
                      ? "bg-white text-emerald-700 shadow-xs border border-border/40 font-black"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <PenTool className="w-3.5 h-3.5" /> Draw Signature
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("upload")}
                  className={cn(
                    "flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-2",
                    activeTab === "upload"
                      ? "bg-white text-emerald-700 shadow-xs border border-border/40 font-black"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Upload Image
                </button>
              </div>

              {/* Draw Tab */}
              {activeTab === "draw" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider">Draw using mouse or touch</span>
                    {hasDrawn && (
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 hover:underline"
                      >
                        <Eraser className="w-3.5 h-3.5" /> Clear Canvas
                      </button>
                    )}
                  </div>
                  <div className="border-2 border-dashed border-border/80 rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-2 flex flex-col items-center justify-center relative shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={420}
                      height={160}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-40 bg-white rounded-xl shadow-xs cursor-crosshair touch-none"
                    />
                    {!hasDrawn && (
                      <div className="absolute pointer-events-none text-slate-400 text-xs font-medium flex items-center gap-1.5">
                        <PenTool className="w-4 h-4" /> Sign your name here...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Tab */}
              {activeTab === "upload" && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Upload PNG / JPG signature</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border/80 hover:border-emerald-500/50 rounded-2xl p-6 bg-slate-50 dark:bg-slate-900/40 text-center cursor-pointer transition-all hover:bg-emerald-500/5 flex flex-col items-center justify-center space-y-2"
                  >
                    {signatureData ? (
                      <div className="space-y-2">
                        <img src={signatureData} alt="Signature Preview" className="max-h-24 object-contain mx-auto border bg-white p-2 rounded-xl shadow-xs" />
                        <span className="text-xs font-bold text-emerald-600 block">Click to choose another image</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-emerald-600" />
                        <div className="text-xs font-bold text-foreground">Click to browse signature image</div>
                        <div className="text-[11px] text-muted-foreground">Transparent PNG recommended</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border/60 bg-card flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-border text-foreground font-bold text-sm rounded-xl hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          {!existingSignature && (
            <button
              type="button"
              onClick={handleSaveSignature}
              disabled={isSaving || !signatureData}
              className="px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-md flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isSaving ? "Saving..." : "Save Signature"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
