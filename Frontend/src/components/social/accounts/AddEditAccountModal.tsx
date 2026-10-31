import React, { useState, useEffect } from "react";
import { X, Instagram, Key, Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import type { SocialAccount, SocialBrand } from "../types";
import { SocialDropdown } from "../components/SocialDropdown";

interface AddEditAccountModalProps {
  isOpen: boolean;
  account?: SocialAccount | null | undefined;
  brands: SocialBrand[];
  onClose: () => void;
  onSave: (data: {
    ig_account_id: string;
    username: string;
    access_token: string;
    brand_id?: string | null;
  }) => Promise<void>;
}

export const AddEditAccountModal: React.FC<AddEditAccountModalProps> = ({
  isOpen,
  account,
  brands,
  onClose,
  onSave,
}) => {
  const [username, setUsername] = useState("");
  const [igAccountId, setIgAccountId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [showToken, setShowToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setUsername(account.username || "");
      setIgAccountId(account.ig_account_id || "");
      setAccessToken("");
      setBrandId(account.brand_id || "");
    } else {
      setUsername("");
      setIgAccountId("");
      setAccessToken("");
      setBrandId("");
    }
    setFormError(null);
  }, [account, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUsername = username.replace(/^@/, "").trim();
    const cleanId = igAccountId.trim();
    const token = accessToken.trim();

    if (!cleanUsername) {
      setFormError("Username is required");
      return;
    }
    if (!cleanId) {
      setFormError("Instagram Account ID is required");
      return;
    }
    if (!account && !token) {
      setFormError("Long-lived User Access Token is required for new accounts");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        username: cleanUsername,
        ig_account_id: cleanId,
        access_token: token,
        brand_id: brandId ? brandId : null,
      });
      onClose();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-2xl p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white">
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {account ? "Edit Connected Account" : "Connect Instagram Account"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Automate DMs and comment replies for this profile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Instagram Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="brand_official"
                className="w-full pl-8 pr-4 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Instagram Business Account ID
            </label>
            <input
              type="text"
              value={igAccountId}
              onChange={(e) => setIgAccountId(e.target.value)}
              disabled={Boolean(account)}
              placeholder="e.g. 17841400000000000"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-border bg-background disabled:bg-muted disabled:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-mono"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Found in Meta Graph API Explorer or Facebook Page Settings
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Linked Brand Profile (Optional)
            </label>
            <SocialDropdown
              value={brandId}
              onChange={setBrandId}
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                {account ? "Update Access Token (Leave empty to keep)" : "Long-Lived User Access Token"}
              </label>
              {account?.has_token && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  Current ends in ...{account.token_last4}
                </span>
              )}
            </div>
            <div className="relative">
              <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input
                type={showToken ? "text" : "password"}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder={account ? "Paste new EAAB... token to update" : "EAAB..."}
                className="w-full pl-10 pr-10 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Must include permissions: <code>instagram_basic</code>, <code>instagram_manage_comments</code>, <code>pages_messaging</code>
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Account"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
