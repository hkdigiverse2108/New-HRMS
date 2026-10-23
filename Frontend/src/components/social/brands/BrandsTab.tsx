import React, { useState } from "react";
import {
  Building2,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  Sparkles,
  RefreshCw,
  X,
  Loader2,
  Globe,
  Tag,
  ShieldAlert,
} from "lucide-react";
import type { SocialBrand } from "../types";

interface BrandsTabProps {
  brands: SocialBrand[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onCreateBrand: (data: Partial<SocialBrand>) => Promise<void>;
  onUpdateBrand: (id: string, data: Partial<SocialBrand>) => Promise<void>;
  onDeleteBrand: (id: string) => Promise<void>;
}

export const BrandsTab: React.FC<BrandsTabProps> = ({
  brands,
  isLoading,
  onRefresh,
  onCreateBrand,
  onUpdateBrand,
  onDeleteBrand,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<SocialBrand | null>(null);

  // Form states
  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [link, setLink] = useState("");
  const [industry, setIndustry] = useState("");
  const [tone, setTone] = useState("Professional, innovative, engaging");
  const [targetAudience, setTargetAudience] = useState("");
  const [signatureCta, setSignatureCta] = useState("");
  const [forbiddenWordsStr, setForbiddenWordsStr] = useState("");
  const [alwaysIncludeHashtagsStr, setAlwaysIncludeHashtagsStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openModal = (brand?: SocialBrand | null) => {
    if (brand) {
      setEditingBrand(brand);
      setBrandId(brand.brand_id || brand.id);
      setBrandName(brand.brand_name || "");
      setLink(brand.link || "");
      setIndustry(brand.industry || "");
      setTone(brand.tone || "");
      setTargetAudience(brand.target_audience || "");
      setSignatureCta(brand.default_cta || "");
      setForbiddenWordsStr((brand.never_use_hashtags || []).join(", "));
      setAlwaysIncludeHashtagsStr((brand.always_include_hashtags || []).join(", "));
    } else {
      setEditingBrand(null);
      setBrandId("");
      setBrandName("");
      setLink("");
      setIndustry("");
      setTone("Professional, innovative, engaging");
      setTargetAudience("");
      setSignatureCta("");
      setForbiddenWordsStr("");
      setAlwaysIncludeHashtagsStr("");
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) {
      setFormError("Brand name is required");
      return;
    }
    const cleanId = brandId.trim() || brandName.toLowerCase().replace(/[^a-z0-9]/g, "_");

    const payload: Partial<SocialBrand> = {
      brand_id: cleanId,
      brand_name: brandName.trim(),
      link: link.trim() || undefined,
      industry: industry.trim() || undefined,
      tone: tone.trim() || undefined,
      target_audience: targetAudience.trim() || undefined,
      default_cta: signatureCta.trim() || undefined,
      never_use_hashtags: forbiddenWordsStr
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean),
      always_include_hashtags: alwaysIncludeHashtagsStr
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean),
    };

    try {
      setIsSubmitting(true);
      if (editingBrand) {
        await onUpdateBrand(editingBrand.id, payload);
      } else {
        await onCreateBrand(payload);
      }
      await onRefresh();
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save brand");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete brand profile "${name}"? Connected Instagram accounts will be unlinked.`)) {
      await onDeleteBrand(id);
      await onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Strip */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Brand Guidelines & Voice Profiles</h3>
          <p className="text-xs text-muted-foreground">
            Configure brand voice, forbidden words, and default CTAs to personalize all AI scripts and captions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefresh()}
            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => openModal(null)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Brand Profile
          </button>
        </div>
      </div>

      {/* Brands Grid */}
      {brands.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <h4 className="text-sm font-bold text-foreground">No Brand Profiles Yet</h4>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Add your company or client brand profiles to ensure AI scripts match their signature voice and audience.
          </p>
          <button
            onClick={() => openModal(null)}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Brand
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {brands.map((b) => (
            <div
              key={b.id}
              className="p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                      {b.brand_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        {b.brand_name}
                        {b.link && (
                          <a
                            href={b.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </h4>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {b.brand_id || b.id}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-foreground">
                    {b.accounts_count || 0} accounts
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  {b.industry && (
                    <div className="text-[11px]">
                      <span className="text-muted-foreground">Industry: </span>
                      <span className="text-foreground font-medium">{b.industry}</span>
                    </div>
                  )}

                  {b.tone && (
                    <div className="text-[11px]">
                      <span className="text-muted-foreground">Tone: </span>
                      <span className="text-foreground font-medium">{b.tone}</span>
                    </div>
                  )}

                  {b.default_cta && (
                    <div className="text-[11px] bg-muted/40 p-2 rounded-lg border border-border/50">
                      <span className="text-muted-foreground block text-[10px] font-bold uppercase mb-0.5">
                        Signature CTA:
                      </span>
                      <span className="text-foreground italic">"{b.default_cta}"</span>
                    </div>
                  )}

                  {b.never_use_hashtags && b.never_use_hashtags.length > 0 && (
                    <div className="text-[11px]">
                      <span className="text-rose-500 font-semibold">Forbidden Words: </span>
                      <span className="text-muted-foreground">{b.never_use_hashtags.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-3 border-t border-border flex items-center justify-end gap-1">
                <button
                  onClick={() => openModal(b)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Edit Brand"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(b.id, b.brand_name)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                  title="Delete Brand"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Brand Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  {editingBrand ? "Edit Brand Profile" : "Create Brand Profile"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Digiverse Media"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Brand Slug / ID
                  </label>
                  <input
                    type="text"
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    placeholder="e.g. digiverse_media"
                    disabled={Boolean(editingBrand)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background disabled:bg-muted outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Website or Link
                  </label>
                  <input
                    type="text"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Industry / Niche
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. Digital Marketing, SaaS"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Tone of Voice
                </label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="e.g. Energetic, authoritative, witty, empathetic"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Founders, B2B marketing managers aged 25-45"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Signature Call to Action (CTA)
                </label>
                <input
                  type="text"
                  value={signatureCta}
                  onChange={(e) => setSignatureCta(e.target.value)}
                  placeholder="e.g. Comment 'GROW' below to get our free growth blueprint"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Forbidden Words / Competitors (Comma-separated)
                </label>
                <input
                  type="text"
                  value={forbiddenWordsStr}
                  onChange={(e) => setForbiddenWordsStr(e.target.value)}
                  placeholder="e.g. cheap, freebie, rival_name"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Always Include Hashtags (Comma-separated)
                </label>
                <input
                  type="text"
                  value={alwaysIncludeHashtagsStr}
                  onChange={(e) => setAlwaysIncludeHashtagsStr(e.target.value)}
                  placeholder="e.g. #DigiverseMedia, #HRMSAutomation"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background outline-none"
                />
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
