import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, UploadCloud, X, Check, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { getAvatarUrl, handleAvatarError } from "@/lib/config";
import { cn } from "@/lib/utils";

interface ChangePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhotoUrl?: string;
  userName: string;
  employeeId: string;
  onPhotoSaved: (newPhotoUrl: string) => void;
}

export function ChangePhotoModal({
  isOpen,
  onClose,
  currentPhotoUrl,
  userName,
  employeeId,
  onPhotoSaved,
}: ChangePhotoModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up preview object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setErrorMsg(null);
      setIsSaving(false);
      setIsDragging(false);
    }
  }, [isOpen]);

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMsg("Please select a valid image file (PNG, JPG, or WEBP).");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setErrorMsg("Image size exceeds 5MB limit. Please choose a smaller photo.");
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleCancel = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    onClose();
  };

  const handleSave = async () => {
    if (!selectedFile) {
      toast.error("Please select an image file first.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      // 1. Upload new image file to server
      const uploadRes = await api.uploadImage(selectedFile, "employee");
      if (!uploadRes || !uploadRes.url) {
        throw new Error("Failed to upload image.");
      }
      const newPhotoUrl = uploadRes.url;

      // 2. Update employee profile in MongoDB database
      const updatePayload = {
        profile_photo: newPhotoUrl,
        personal_info: {
          profile_photo: newPhotoUrl,
        },
      };

      await api.put(`/employees/${employeeId}`, updatePayload, {
        showLoader: false,
        showErrorToast: true,
      });

      // 3. Delete the OLD image from server storage to save disk space
      // ONLY done after successful save!
      if (currentPhotoUrl && typeof currentPhotoUrl === "string") {
        const isExternal =
          currentPhotoUrl.includes("ui-avatars.com") ||
          currentPhotoUrl.includes("dicebear.com") ||
          currentPhotoUrl.includes("unsplash.com");

        if (!isExternal && currentPhotoUrl !== newPhotoUrl) {
          try {
            await api.deleteImage(currentPhotoUrl);
          } catch (deleteErr) {
            console.warn("Could not delete old avatar file from server storage:", deleteErr);
          }
        }
      }

      toast.success("Profile photo updated successfully!");
      onPhotoSaved(newPhotoUrl);
      handleCancel();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to update profile photo.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const displayedAvatar = previewUrl || getAvatarUrl(currentPhotoUrl, userName);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="w-[calc(100vw-16px)] sm:max-w-md p-0 overflow-hidden rounded-2xl sm:rounded-[2rem] gap-0 border-border/60 shadow-2xl [&>button]:hidden bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Change Profile Photo</h2>
              <p className="text-xs text-muted-foreground">Upload your picture directly from your device</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative group">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white shadow-xl ring-2 ring-border/50 bg-muted/40 flex items-center justify-center">
                <img
                  src={displayedAvatar}
                  alt={userName}
                  className="w-full h-full object-cover"
                  onError={handleAvatarError}
                />
              </div>

              {selectedFile && (
                <div className="absolute -top-2 -right-2 px-2.5 py-0.5 bg-emerald-500 text-white rounded-full text-[10px] font-bold shadow-md flex items-center gap-1 border-2 border-white">
                  <Check className="w-3 h-3" /> Ready
                </div>
              )}
            </div>

            <p className="text-xs font-medium text-muted-foreground mt-3">
              {selectedFile ? "Preview of new photo" : "Current profile photo"}
            </p>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2",
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : selectedFile
                ? "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/10"
                : "border-border/80 hover:border-primary/60 hover:bg-muted/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file);
                }
              }}
            />

            <div className={cn(
              "p-3 rounded-2xl transition-colors",
              selectedFile ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
            )}>
              <UploadCloud className="w-6 h-6" />
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground truncate max-w-[280px]">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Click to choose another
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  <span className="font-bold text-primary">Click to browse</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP (Max 5MB)</p>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-muted/40 rounded-xl p-3 text-[11px] text-muted-foreground space-y-1 leading-relaxed">
            <p className="font-semibold text-foreground/80">&bull; Your old photo will be automatically deleted upon saving to save space.</p>
            <p>&bull; If you cancel, your existing photo remains unchanged.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/50 bg-muted/20">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedFile || isSaving}
            className={cn(
              "px-5 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm",
              selectedFile && !isSaving
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Photo</span>
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
