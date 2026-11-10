import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Users,
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { User, AdminRecord } from '../types.ts';
import { api } from '../api.ts';
import { OWNER_ADMIN_EMAIL } from '../firebase.ts';

interface AdminConsoleViewProps {
  currentUser: User;
  currency: string;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  currentUser,
  currency,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'admins'>('all');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminGetPlatformDirectory();
      setUsers(res.users);
      setAdmins(res.admins);
    } catch (err: any) {
      setError(
        err?.message ||
          'Unable to load platform directory. Verify that your account has verified administrator access.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const showBanner = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(null), 3500);
  };

  const handleToggleStatus = async (target: User) => {
    if (target.email.toLowerCase() === OWNER_ADMIN_EMAIL || target.id === currentUser.id) {
      return;
    }
    const nextStatus = target.status === 'suspended' ? 'active' : 'suspended';
    setBusyUserId(target.id);
    setError(null);
    try {
      await api.adminUpdateUserStatus(target.id, nextStatus);
      showBanner(
        `Account ${target.email} marked as ${nextStatus}.`
      );
      await loadDirectory();
    } catch (err: any) {
      setError(err?.message || 'Failed to update account status.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleToggleAdmin = async (target: User) => {
    if (target.email.toLowerCase() === OWNER_ADMIN_EMAIL) {
      return;
    }
    setBusyUserId(target.id);
    setError(null);
    try {
      if (target.isAdmin) {
        await api.adminRevokeAdminAccess(target);
        showBanner(`Revoked administrator access for ${target.email}.`);
      } else {
        await api.adminGrantAdminAccess(target);
        showBanner(`Granted administrator access to ${target.email}.`);
      }
      await loadDirectory();
    } catch (err: any) {
      setError(err?.message || 'Failed to update administrator privileges.');
    } finally {
      setBusyUserId(null);
    }
  };

  if (!currentUser.isAdmin) {
    return (
      <div className="p-6 rounded-xl surface-card space-y-2 text-[13px]">
        <div className="text-negative font-medium">Access denied</div>
        <p className="text-ink-secondary">
          The Admin Console is restricted to verified platform administrators.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    if (statusFilter === 'active' && u.status === 'suspended') return false;
    if (statusFilter === 'suspended' && u.status !== 'suspended') return false;
    if (statusFilter === 'admins' && !u.isAdmin) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchCollege = (u.collegeName || '').toLowerCase().includes(q);
      const matchId = u.id.toLowerCase().includes(q);
      return matchName || matchEmail || matchCollege || matchId;
    }
    return true;
  });

  const totalUsers = users.length;
  const activeCount = users.filter((u) => u.status !== 'suspended').length;
  const suspendedCount = users.filter((u) => u.status === 'suspended').length;
  const adminCount = users.filter((u) => u.isAdmin).length || Math.max(1, admins.length);
  const avgBudget =
    totalUsers > 0
      ? Math.round(users.reduce((sum, u) => sum + (u.monthlyBudget || 0), 0) / totalUsers)
      : 0;

  return (
    <div className="space-y-6 pb-16 font-sans w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <div className="text-[12px] font-mono text-[#2dd4bf] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
            <span>Verified Owner &amp; Admin Governance</span>
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-medium text-ink-primary tracking-tight leading-tight">
            Platform admin console
          </h1>
        </div>
        <button
          type="button"
          onClick={loadDirectory}
          disabled={loading}
          className="h-9 px-3.5 btn-secondary rounded-lg text-[13px] flex items-center gap-2 self-start sm:self-auto shrink-0 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-ink-muted shrink-0 ${loading ? 'animate-spin' : ''}`}
            strokeWidth={1.5}
          />
          <span>Refresh directory</span>
        </button>
      </div>

      {/* Platform KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        <div className="p-4 sm:p-5 rounded-xl surface-card space-y-1.5 min-w-0">
          <span className="text-[12px] text-ink-muted block">Registered accounts</span>
          <div className="text-[24px] font-medium text-ink-primary font-mono tabular-nums">
            {totalUsers}
          </div>
          <div className="text-[12px] text-ink-secondary">
            {activeCount} active · {suspendedCount} suspended
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-xl surface-card space-y-1.5 min-w-0">
          <span className="text-[12px] text-ink-muted block">Verified administrators</span>
          <div className="text-[24px] font-medium text-ink-primary font-mono tabular-nums">
            {adminCount}
          </div>
          <div className="text-[12px] text-ink-secondary truncate">
            Owner: {OWNER_ADMIN_EMAIL}
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-xl surface-card space-y-1.5 min-w-0">
          <span className="text-[12px] text-ink-muted block">Avg. monthly allowance</span>
          <div className="text-[24px] font-medium text-ink-primary font-mono tabular-nums">
            {currency}{avgBudget.toLocaleString()}
          </div>
          <div className="text-[12px] text-ink-secondary">
            Across registered student profiles
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-xl surface-card space-y-1.5 min-w-0">
          <span className="text-[12px] text-ink-muted block">Ledger privacy enforcement</span>
          <div className="text-[15px] font-medium text-[#2dd4bf] font-mono pt-1">
            Zero-Trust Isolated
          </div>
          <div className="text-[12px] text-ink-secondary">
            Private transactions locked to owner UID
          </div>
        </div>
      </div>

      {/* Privacy & Security Governance Notice */}
      <div className="p-4 rounded-xl surface-card border hairline-border flex items-start gap-3 text-[13px] min-w-0">
        <Lock className="w-4 h-4 text-[#2dd4bf] shrink-0 mt-0.5" strokeWidth={1.5} />
        <div className="space-y-1 min-w-0">
          <div className="font-medium text-ink-primary">
            Sensitive financial ledger isolation is active
          </div>
          <p className="text-ink-secondary leading-relaxed">
            In accordance with CostCurve security rules (<code className="font-mono text-[12px]">firestore.rules</code>), administrator privileges allow managing registered user profiles, account lifecycle status (<code className="font-mono text-[12px]">active</code> / <code className="font-mono text-[12px]">suspended</code>), and the <code className="font-mono text-[12px]">/admins</code> registry. Individual student transactions, budgets, savings goals, and peer debts remain strictly private to each student&apos;s authenticated UID.
          </p>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 rounded-lg bg-[#2dd4bf]/10 border border-[#2dd4bf]/30 text-[#2dd4bf] text-[13px]">
          {actionMsg}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-[#e5484d]/10 border border-[#e5484d]/30 text-negative text-[13px] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* User Directory & Controls */}
      <div className="rounded-xl surface-card overflow-hidden min-w-0">
        <div className="p-4 sm:p-5 border-b hairline-border flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-ink-muted shrink-0" strokeWidth={1.5} />
            <h2 className="text-[15px] font-medium text-ink-primary">
              Registered student accounts ({filteredUsers.length})
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 min-w-0">
            <div className="relative flex-1 sm:w-64 min-w-0">
              <Search
                className="w-3.5 h-3.5 text-ink-muted absolute left-3 top-2.5"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, campus, UID..."
                className="w-full min-w-0 h-8 pl-8 pr-3 input-field rounded-lg text-[12px]"
              />
            </div>

            <div className="flex items-center gap-1 p-0.5 surface-deep rounded-lg border hairline-border text-[12px] overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'suspended', label: 'Suspended' },
                  { id: 'admins', label: 'Admins' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`h-7 px-2.5 rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'surface-active-row text-ink-primary font-medium'
                      : 'text-ink-muted hover:text-ink-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[13px] text-ink-muted font-mono">
            Loading registered accounts from Cloud Firestore...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-ink-muted">
            No registered accounts match your current filter.
          </div>
        ) : (
          <div className="divide-y hairline-divide">
            {filteredUsers.map((u) => {
              const isPrimaryOwner = u.email.toLowerCase() === OWNER_ADMIN_EMAIL;
              const isSelf = u.id === currentUser.id;
              const isSuspended = u.status === 'suspended';
              const isBusy = busyUserId === u.id;

              return (
                <div
                  key={u.id}
                  className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[var(--bg-raised)]/40 transition-colors min-w-0"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-[14px] font-medium text-ink-primary truncate">
                        {u.name}
                      </span>
                      <span className="text-[12px] font-mono text-ink-secondary break-all">
                        {u.email}
                      </span>
                      {isPrimaryOwner ? (
                        <span className="text-[11px] font-mono text-[#2dd4bf] px-1.5 py-0.5 rounded bg-[#2dd4bf]/10 border border-[#2dd4bf]/30">
                          Owner
                        </span>
                      ) : u.isAdmin ? (
                        <span className="text-[11px] font-mono text-[#2dd4bf] px-1.5 py-0.5 rounded bg-[#2dd4bf]/10 border border-[#2dd4bf]/30">
                          Admin
                        </span>
                      ) : null}
                      <span
                        className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                          isSuspended
                            ? 'text-negative bg-[#e5484d]/10 border-[#e5484d]/30'
                            : 'text-ink-muted surface-deep hairline-border'
                        }`}
                      >
                        {isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted font-mono">
                      <span>UID: {u.id.slice(0, 14)}…</span>
                      <span>·</span>
                      <span>{u.collegeName || 'College / University'}</span>
                      <span>·</span>
                      <span>
                        Budget: {u.currency || currency}
                        {(u.monthlyBudget || 0).toLocaleString()}/mo
                      </span>
                      <span>·</span>
                      <span>
                        Joined{' '}
                        {new Date(u.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Admin Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!isPrimaryOwner && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleAdmin(u)}
                        className="h-8 px-3 btn-secondary rounded-lg text-[12px] flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
                        <span>{u.isAdmin ? 'Revoke admin' : 'Grant admin'}</span>
                      </button>
                    )}

                    {!isPrimaryOwner && !isSelf && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleStatus(u)}
                        className={`h-8 px-3 rounded-lg text-[12px] flex items-center gap-1.5 border transition-colors disabled:opacity-50 ${
                          isSuspended
                            ? 'border-[#2dd4bf]/30 bg-[#2dd4bf]/10 text-[#2dd4bf] hover:bg-[#2dd4bf]/20'
                            : 'border-[#e5484d]/30 bg-[#e5484d]/10 text-negative hover:bg-[#e5484d]/20'
                        }`}
                      >
                        {isSuspended ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span>Reactivate</span>
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span>Suspend</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
