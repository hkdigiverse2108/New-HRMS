import React, { useState } from "react";
import {
  Plus,
  Instagram,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  ExternalLink,
  ShieldCheck,
  Power,
  Trash2,
  Edit2,
  Activity,
  Loader2,
} from "lucide-react";
import type { SocialAccount, SocialBrand } from "../types";
import { TokenBadge } from "./TokenBadge";
import { AddEditAccountModal } from "./AddEditAccountModal";

interface AccountsTabProps {
  accounts: SocialAccount[];
  brands: SocialBrand[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onCreateAccount: (data: {
    ig_account_id: string;
    username: string;
    access_token: string;
    brand_id?: string | null;
  }) => Promise<void>;
  onUpdateAccount: (
    id: string,
    data: { username?: string; access_token?: string; brand_id?: string | null; is_active?: boolean }
  ) => Promise<void>;
  onToggleAccount: (id: string) => Promise<void>;
  onRefreshToken: (id: string) => Promise<{ success: boolean; hint: string }>;
  onTestToken: (id: string) => Promise<{ valid: boolean; hint: string }>;
  onDeleteAccount: (id: string) => Promise<void>;
}

export const AccountsTab: React.FC<AccountsTabProps> = ({
  accounts,
  brands,
  isLoading,
  onRefresh,
  onCreateAccount,
  onUpdateAccount,
  onToggleAccount,
  onRefreshToken,
  onTestToken,
  onDeleteAccount,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [search, setSearch] = useState("");
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const filteredAccounts = accounts.filter(
    (a) =>
      a.username.toLowerCase().includes(search.toLowerCase()) ||
      a.ig_account_id.includes(search)
  );

  const total = accounts.length;
  const activeCount = accounts.filter((a) => a.is_active).length;
  const warningCount = accounts.filter((a) => (a.days_since_refresh ?? 0) >= 50).length;

  const handleTestToken = async (id: string) => {
    try {
      setBusyActionId(id);
      const res = await onTestToken(id);
      setActionNotice({ id, text: res.hint, ok: res.valid });
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: unknown) {
      setActionNotice({
        id,
        text: err instanceof Error ? err.message : "Test failed",
        ok: false,
      });
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRefreshToken = async (id: string) => {
    try {
      setBusyActionId(id);
      const res = await onRefreshToken(id);
      setActionNotice({ id, text: res.hint, ok: res.success });
      await onRefresh();
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: unknown) {
      setActionNotice({
        id,
        text: err instanceof Error ? err.message : "Refresh failed",
        ok: false,
      });
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (confirm(`Are you sure you want to disconnect @${username}? Automation rules for this account will be preserved.`)) {
      await onDeleteAccount(id);
      await onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Connected Accounts
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Instagram className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground font-medium">profiles</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Automation
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{activeCount}</span>
            <span className="text-xs text-emerald-500 font-medium">live responding</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Token Health
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{warningCount}</span>
            <span className="text-xs text-amber-500 font-medium">
              {warningCount === 0 ? "all tokens healthy" : "expiring soon / check"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts by username or ID..."
            className="w-full pl-3.5 pr-4 py-2 text-xs rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefresh()}
            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => {
              setEditingAccount(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Connect Account
          </button>
        </div>
      </div>

      {/* Accounts List */}
      {filteredAccounts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <Instagram className="w-6 h-6" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">No Instagram Accounts Connected</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Connect an Instagram Professional/Creator account with its long-lived user token to enable automated DM replies.
          </p>
          <button
            onClick={() => {
              setEditingAccount(null);
              setIsModalOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAccounts.map((account) => {
            const brand = brands.find((b) => (b.brand_id || b.id) === account.brand_id);
            const isBusy = busyActionId === account.id;
            const notice = actionNotice?.id === account.id ? actionNotice : null;

            return (
              <div
                key={account.id}
                className="group relative p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5 shadow-sm">
                        <div className="w-full h-full bg-card rounded-[14px] flex items-center justify-center font-bold text-base text-foreground">
                          {account.username.slice(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card ${
                          account.is_active ? "bg-emerald-500" : "bg-muted-foreground"
                        }`}
                        title={account.is_active ? "Active" : "Paused"}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-foreground">
                          @{account.username}
                        </h4>
                        <a
                          href={`https://instagram.com/${account.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                        <span className="font-mono">ID: {account.ig_account_id}</span>
                        {brand && (
                          <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-medium">
                            {brand.brand_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <TokenBadge
                      hasToken={account.has_token}
                      daysSinceRefresh={account.days_since_refresh}
                      lastRefreshStatus={account.last_refresh_status}
                    />
                  </div>
                </div>

                {notice && (
                  <div
                    className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      notice.ok
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    }`}
                  >
                    {notice.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">{notice.text}</span>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleAccount(account.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                        account.is_active
                          ? "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {account.is_active ? "Responding" : "Paused"}
                    </button>

                    <button
                      onClick={() => handleTestToken(account.id)}
                      disabled={isBusy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[11px]"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Test
                    </button>

                    <button
                      onClick={() => handleRefreshToken(account.id)}
                      disabled={isBusy}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[11px]"
                      title="Request 60-day token extension"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Refresh Token
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingAccount(account);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Edit Account"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id, account.username)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title="Delete Account"
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

      {/* Add / Edit Modal */}
      <AddEditAccountModal
        isOpen={isModalOpen}
        account={editingAccount}
        brands={brands}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAccount(null);
        }}
        onSave={async (data) => {
          if (editingAccount) {
            await onUpdateAccount(editingAccount.id, data);
          } else {
            await onCreateAccount(data);
          }
          await onRefresh();
        }}
      />
    </div>
  );
};
