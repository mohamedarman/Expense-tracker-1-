import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon } from 'lucide-react';
import { api } from '../api.ts';
import { User } from '../types.ts';
import logo from '../assets/logo.png';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [degreeSemester, setDegreeSemester] = useState('Semester 3 (B.Tech CS)');
  const [monthlyBudget, setMonthlyBudget] = useState('15000');
  const [currency, setCurrency] = useState('₹');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        const res = await api.register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
          collegeName: collegeName.trim() || 'College / University',
          degreeSemester: degreeSemester.trim(),
          monthlyBudget: parseFloat(monthlyBudget) || 15000,
          currency,
        });
        onSuccess(res.user);
      } else {
        const res = await api.login(email.trim().toLowerCase(), password);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen surface-page text-ink-primary grid grid-cols-1 lg:grid-cols-12 font-sans">
      {/* Left Column: Asymmetric Editorial & Product Preview */}
      <div className="hidden lg:flex lg:col-span-7 surface-deep border-r hairline-border p-12 xl:p-16 flex-col justify-between">
        <div className="max-w-xl space-y-6">
          <div className="text-[13px] font-mono text-ink-muted">
            Student allowance and expense ledger
          </div>
          <h2 className="text-[36px] xl:text-[42px] font-medium text-ink-primary leading-[1.1] tracking-[-0.02em] text-balance">
            Know what you can spend today without running short before exams
          </h2>
          <p className="text-[15px] text-ink-secondary leading-relaxed max-w-lg">
            CostCurve divides your remaining monthly stipend by the days left in the month, tracks hostel and mess commitments, and keeps roommate splits in one private ledger.
          </p>
        </div>

        {/* Rendered Product Preview & Physical Campus Card Moment */}
        <div className="max-w-xl w-full space-y-4 my-8">
          {/* Physical Campus Allowance Card built in code with real material steps */}
          <div
            className="p-6 rounded-xl bg-[#1c1c1f] border border-white/10 text-[#ededed] space-y-6"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 16px 36px rgba(0,0,0,0.4)' }}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[12px] text-[#85858b] font-mono">Daily safe-to-spend rate</div>
                <div className="text-[28px] font-medium font-mono tabular-nums tracking-tight text-[#2dd4bf]">
                  ₹412.50 <span className="text-[13px] font-normal text-[#a1a1a6]">/ day</span>
                </div>
              </div>
              {/* Tactile Metallic Chip */}
              <div
                className="w-10 h-7 rounded-md bg-[#2a2a2e] border border-white/15 grid grid-cols-3 gap-px p-1"
                aria-hidden="true"
              >
                <div className="border-r border-b border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-l border-b border-white/10" />
                <div className="border-r border-white/10" />
                <div />
                <div className="border-l border-white/10" />
              </div>
            </div>

            {/* Allowance Pace Bar with Today Marker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px] font-mono text-[#a1a1a6]">
                <span>₹8,400 spent of ₹15,000 budget</span>
                <span>16 days left</span>
              </div>
              <div className="relative h-2 bg-[#111113] rounded-sm overflow-hidden">
                <div className="h-full bg-[#2dd4bf]" style={{ width: '56%' }} />
              </div>
            </div>

            <div className="pt-3 border-t border-white/8 flex items-center justify-between text-[12px] font-mono text-[#85858b]">
              <span>Semester 5 · Computer Science</span>
              <span> Essential share: 74%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[12px] text-ink-muted font-mono">
          <span>Private account isolation</span>
          <span>CSV import and PDF statements</span>
        </div>
      </div>

      {/* Right Column: Authentication Panel */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-10 overflow-y-auto">
        <div className="w-full max-w-[380px] space-y-6">
          {/* Brand Header: Logo placed above CostCurve heading */}
          <div className="flex flex-col items-center text-center space-y-2.5">
            <img
              src={logo}
              alt="CostCurve logo"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl object-contain"
            />
            <div className="space-y-1">
              <h1 className="text-[22px] font-medium text-ink-primary tracking-tight leading-tight">
                CostCurve
              </h1>
              <p className="text-[13px] text-ink-secondary">
                Student expense and allowance tracker
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 surface-deep rounded-lg border hairline-border text-[13px]">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`h-8 rounded-md transition-colors ${
                !isRegister
                  ? 'surface-active-row text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary font-normal'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`h-8 rounded-md transition-colors ${
                isRegister
                  ? 'surface-active-row text-ink-primary font-medium'
                  : 'text-ink-muted hover:text-ink-primary font-normal'
              }`}
            >
              Create account
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#e5484d]/10 border border-[#e5484d]/30 text-negative text-[13px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-[13px]">
            {isRegister && (
              <div className="space-y-1.5">
                <label className="block text-ink-secondary">Full name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-2.5 text-ink-muted" strokeWidth={1.5} />
                  <input
                    type="text"
                    required
                    placeholder="Alex Chen"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 input-field rounded-lg text-[13px]"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-ink-secondary">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-ink-muted" strokeWidth={1.5} />
                <input
                  type="email"
                  required
                  placeholder="student@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 input-field rounded-lg text-[13px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-ink-secondary">
                Password {isRegister && <span className="text-ink-muted">(8+ characters)</span>}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-2.5 text-ink-muted" strokeWidth={1.5} />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 input-field rounded-lg text-[13px]"
                />
              </div>
            </div>

            {isRegister && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-ink-secondary">Confirm password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-ink-muted" strokeWidth={1.5} />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 input-field rounded-lg text-[13px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-ink-secondary">College or university</label>
                    <input
                      type="text"
                      placeholder="State Tech"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="w-full h-9 px-3 input-field rounded-lg text-[13px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-ink-secondary">Degree and semester</label>
                    <input
                      type="text"
                      placeholder="Sem 3"
                      value={degreeSemester}
                      onChange={(e) => setDegreeSemester(e.target.value)}
                      className="w-full h-9 px-3 input-field rounded-lg text-[13px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-ink-secondary">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full h-9 px-3 input-field rounded-lg text-[13px] font-mono"
                    >
                      <option value="₹">₹ INR</option>
                      <option value="$">$ USD</option>
                      <option value="€">€ EUR</option>
                      <option value="£">£ GBP</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-ink-secondary">Monthly allowance</label>
                    <input
                      type="number"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(e.target.value)}
                      className="w-full h-9 px-3 input-field rounded-lg text-[13px] font-mono tabular-nums"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 btn-primary rounded-lg text-[13px] font-medium disabled:opacity-50 mt-2"
            >
              {loading
                ? 'Please wait...'
                : isRegister
                ? 'Create student account'
                : 'Sign in to CostCurve'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
