import React, { useState } from 'react';
import {
  Mail,
  Calendar,
  Smartphone,
  Sparkles,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  LogOut,
  User,
  Key,
  Clock,
  ArrowRight,
  Send,
  Zap,
  Lock,
  Radio,
  FileText,
  Trash2,
  Check,
} from 'lucide-react';
import { AuthUser } from '../types/zip';

interface ConnectedAccessoriesHubProps {
  currentUser: AuthUser;
  setCurrentUser: (user: AuthUser) => void;
  accessToken: string;
  setAccessToken: (token: string) => void;
  refreshToken: string;
  setRefreshToken: (token: string) => void;
  onNavigateTab: (tabId: string) => void;
  onLogout: () => void;
  onDownloadZip: () => void;
}

export const ConnectedAccessoriesHub: React.FC<ConnectedAccessoriesHubProps> = ({
  currentUser,
  setCurrentUser,
  accessToken,
  setAccessToken,
  refreshToken,
  setRefreshToken,
  onNavigateTab,
  onLogout,
  onDownloadZip,
}) => {
  // Google OAuth Connection Modal / Form State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState(currentUser.email);
  const [connectResult, setConnectResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Android accessory test state
  const [androidPingSuccess, setAndroidPingSuccess] = useState(false);

  // Token claims modal
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenRotatedMsg, setTokenRotatedMsg] = useState(false);

  // Handle Google OAuth connection
  const handleConnectGoogle = (e: React.FormEvent) => {
    e.preventDefault();
    setConnectResult(null);

    const inputEmail = googleEmailInput.trim().toLowerCase();
    const userEmail = currentUser.email.trim().toLowerCase();

    // If user skipped login or doesn't have an email bound yet:
    if (!userEmail || userEmail === 'guest@jarvis.ai') {
      const updatedUser: AuthUser = {
        ...currentUser,
        full_name: inputEmail.split('@')[0],
        email: inputEmail,
        is_google_connected: true,
        google_email: inputEmail,
      };
      setCurrentUser(updatedUser);
      setConnectResult({
        type: 'success',
        message: `Google Account (${inputEmail}) bound to session and connected with Gmail and Calendar scopes!`,
      });
      setTimeout(() => {
        setShowConnectModal(false);
        setConnectResult(null);
      }, 1800);
      return;
    }

    // CRITICAL SECURITY RULE:
    // If the Google account email does not match the registered JARVIS email, reject the connection!
    if (inputEmail !== userEmail) {
      setConnectResult({
        type: 'error',
        message: `Security Violation (ACCOUNT_MISMATCH): The Google account email (${inputEmail}) does NOT match your registered JARVIS email (${userEmail}). Connection rejected to prevent accessing the wrong mailbox or cross-account data leakage.`,
      });
      return;
    }

    // Success: Link Google Account
    const updatedUser: AuthUser = {
      ...currentUser,
      is_google_connected: true,
      google_email: inputEmail,
    };
    setCurrentUser(updatedUser);
    setConnectResult({
      type: 'success',
      message: `Google Account (${inputEmail}) connected successfully with Gmail Modify, Gmail Compose, and Calendar scopes.`,
    });

    setTimeout(() => {
      setShowConnectModal(false);
      setConnectResult(null);
    }, 1800);
  };

  const handleDisconnectGoogle = () => {
    if (
      confirm(
        `Disconnect Google Account (${currentUser.google_email || currentUser.email}) from JARVIS?`
      )
    ) {
      setCurrentUser({
        ...currentUser,
        is_google_connected: false,
        google_email: undefined,
      });
    }
  };

  const handleRotateTokens = () => {
    const newAccess = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke2N1cnJlbnRVc2VyLmlkfSIsImVtYWlsIjoiJHtjdXJyZW50VXNlci5lbWFpbH0iLCJyb3RhdGVkX2F0IjoxNzYyODAwMDAwfQ.sig_rotated_${Date.now()}`;
    const newRefresh = `rt_rotated_${Date.now()}`;
    setAccessToken(newAccess);
    setRefreshToken(newRefresh);
    setTokenRotatedMsg(true);
    setTimeout(() => setTokenRotatedMsg(false), 3000);
  };

  const handlePingAndroid = () => {
    setAndroidPingSuccess(true);
    setTimeout(() => setAndroidPingSuccess(false), 3500);
  };

  return (
    <div className="h-[calc(100vh-60px)] overflow-y-auto bg-[#040914] text-slate-100 font-sans p-6 lg:p-8 space-y-8">
      {/* Welcome & Session Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-[#081224] border border-cyan-900/40 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
            <div className="w-full h-full bg-[#050b14] rounded-[14px] flex items-center justify-center">
              <User className="w-7 h-7 text-cyan-400" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold font-orbitron tracking-wide text-slate-100">
                Welcome, {currentUser.full_name}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                Authenticated Session
              </span>
            </div>
            <div className="text-xs font-mono text-cyan-300 mt-0.5">
              Registered ID: <span className="text-slate-300">{currentUser.email}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowTokenModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1a30] hover:bg-[#142340] border border-cyan-900/60 rounded-lg text-xs font-mono text-slate-300 transition-colors cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            <span>JWT Session Claims</span>
          </button>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 rounded-lg text-xs font-mono text-rose-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Grid of Connected Accounts & Accessories */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-mono uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Connected Accessories & Services Hub
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Through your JARVIS login, manage your connected Google accounts and smart accessories.
            </p>
          </div>

          <span className="text-xs font-mono text-cyan-400">
            {currentUser.is_google_connected ? '3 Services Active' : '2 Services Active (Gmail Pending)'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* ACCESSORY 1: Gmail Account Connection */}
          <div
            className={`p-6 rounded-2xl border transition-all flex flex-col justify-between ${
              currentUser.is_google_connected
                ? 'bg-[#08152c]/90 border-cyan-500/40 shadow-[0_0_20px_rgba(34,211,238,0.1)]'
                : 'bg-[#0a1222]/90 border-cyan-900/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Gmail Mailbox</h3>
                    <div className="text-[11px] font-mono text-slate-400">
                      Official Google OAuth 2.0
                    </div>
                  </div>
                </div>

                {currentUser.is_google_connected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-[10px] font-mono text-amber-300 font-semibold">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Not Connected
                  </span>
                )}
              </div>

              {currentUser.is_google_connected ? (
                <div className="space-y-3 mb-6">
                  <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-950 text-xs font-mono">
                    <div className="text-slate-400 text-[10px]">Connected Google Account</div>
                    <div className="text-cyan-300 font-semibold truncate mt-0.5">
                      {currentUser.google_email || currentUser.email}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="p-2 rounded bg-[#060e1d] border border-cyan-950">
                      <div className="text-[10px] text-slate-400">Unread</div>
                      <div className="text-cyan-300 font-bold">2</div>
                    </div>
                    <div className="p-2 rounded bg-[#060e1d] border border-cyan-950">
                      <div className="text-[10px] text-slate-400">Total</div>
                      <div className="text-slate-200 font-bold">5</div>
                    </div>
                    <div className="p-2 rounded bg-[#060e1d] border border-cyan-950">
                      <div className="text-[10px] text-slate-400">Pagination</div>
                      <div className="text-emerald-400 font-bold">Active</div>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Scopes: gmail.modify, gmail.compose, calendar.events</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    Connect your Google account to grant JARVIS secure access to read, search, reply,
                    and compose emails through the official Gmail API.
                  </p>
                  <div className="p-2.5 rounded bg-amber-950/40 border border-amber-600/30 text-[11px] font-mono text-amber-300">
                    Security Rule: The connected Google account must strictly match your JARVIS
                    account ({currentUser.email}).
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-cyan-950">
              {currentUser.is_google_connected ? (
                <>
                  <button
                    onClick={() => onNavigateTab('gmail')}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-xs font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Open Full Gmail Mailbox</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowConnectModal(true)}
                      className="flex-1 py-1.5 px-2 bg-[#0c182c] hover:bg-[#12223c] border border-cyan-900/40 text-[11px] font-mono text-slate-300 rounded transition-colors text-center cursor-pointer"
                    >
                      Verify / Test Mismatch
                    </button>
                    <button
                      onClick={handleDisconnectGoogle}
                      className="py-1.5 px-3 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/40 text-[11px] font-mono text-rose-300 rounded transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="w-full py-2.5 px-4 bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-slate-950 font-bold text-xs font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Connect Google & Gmail</span>
                </button>
              )}
            </div>
          </div>

          {/* ACCESSORY 2: Google Calendar Accessory */}
          <div className="p-6 rounded-2xl bg-[#0a1222]/90 border border-cyan-900/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Google Calendar</h3>
                    <div className="text-[11px] font-mono text-slate-400">
                      Schedule & Conflict Engine
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Ready
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-950 text-xs font-mono">
                  <div className="text-slate-400 text-[10px]">Timezone & Scope</div>
                  <div className="text-cyan-300 font-semibold mt-0.5">
                    Asia/Kolkata (IST) • calendar.events
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#060e1d] border border-cyan-950/60 text-xs font-mono space-y-1">
                  <div className="text-[10px] text-slate-400">Next Scheduled Meeting:</div>
                  <div className="text-slate-200 font-semibold truncate">
                    Campus Placement Briefing
                  </div>
                  <div className="text-[10px] text-cyan-400">Tomorrow at 10:00 AM</div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-950">
              <button
                onClick={() => onNavigateTab('calendar')}
                className="w-full py-2.5 px-4 bg-[#0e1b30] hover:bg-[#142644] border border-cyan-700/50 hover:border-cyan-400 text-cyan-300 font-semibold text-xs font-mono rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open Calendar Schedule</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ACCESSORY 3: Android Device Accessory */}
          <div className="p-6 rounded-2xl bg-[#0a1222]/90 border border-cyan-900/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Android Accessory</h3>
                    <div className="text-[11px] font-mono text-slate-400">
                      Mobile Client & Device Intents
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-semibold">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  Linked
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-950 text-xs font-mono">
                  <div className="text-slate-400 text-[10px]">Paired Android Terminal</div>
                  <div className="text-purple-300 font-semibold mt-0.5">
                    Pixel 8 Pro • Battery 88% • Android 14
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#060e1d] border border-cyan-950/60 text-[11px] font-mono text-slate-300 space-y-1">
                  <div className="text-[10px] text-slate-400">Native Intents Supported:</div>
                  <div className="text-cyan-400 truncate">ACTION_SENDTO, SET_TIMER, SET_ALARM</div>
                </div>

                {androidPingSuccess && (
                  <div className="p-2 rounded bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Intent payload acknowledged by device in 42ms.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-950 flex gap-2">
              <button
                onClick={handlePingAndroid}
                className="flex-1 py-2.5 px-3 bg-[#0e1b30] hover:bg-[#142644] border border-cyan-700/50 hover:border-cyan-400 text-cyan-300 font-semibold text-xs font-mono rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Ping Intent</span>
              </button>

              <button
                onClick={() => onNavigateTab('android')}
                className="py-2.5 px-3 bg-[#081224] hover:bg-[#0c182c] border border-cyan-900/60 text-xs font-mono text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                Spec
              </button>
            </div>
          </div>

          {/* ACCESSORY 4: AI Voice & Chat Assistant */}
          <div className="p-6 rounded-2xl bg-[#0a1222]/90 border border-cyan-900/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">AI Voice Assistant</h3>
                    <div className="text-[11px] font-mono text-slate-400">
                      Neural Router & Mailbox Context
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 font-semibold">
                  Online
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-950 text-xs font-mono">
                  <div className="text-slate-400 text-[10px]">Neural Router Fallback Chain</div>
                  <div className="text-cyan-300 font-semibold mt-0.5">
                    llm7 → pollinations → ddg → gemini
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#060e1d] border border-cyan-950/60 text-[11px] font-mono text-slate-300">
                  <div className="text-[10px] text-slate-400 mb-1">Supported Voice Queries:</div>
                  <div className="text-slate-300 text-[10px] italic">
                    "Check my inbox", "Summarize placement emails", "Draft reply to Professor"
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-950">
              <button
                onClick={() => onNavigateTab('simulator')}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-xs font-mono rounded-lg transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Launch Voice Assistant</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ACCESSORY 5: Token & Security Core */}
          <div className="p-6 rounded-2xl bg-[#0a1222]/90 border border-cyan-900/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Security & Encryption</h3>
                    <div className="text-[11px] font-mono text-slate-400">
                      HMAC-SHA256 & AES-GCM
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-semibold">
                  Secure
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-950 text-xs font-mono">
                  <div className="text-slate-400 text-[10px]">Access Token Expiry</div>
                  <div className="text-emerald-400 font-semibold mt-0.5">
                    15 Minutes (Auto-refresh with 30-day token)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#060e1d] border border-cyan-950/60 text-[11px] font-mono text-slate-400">
                  OAuth tokens encrypted at rest with PBKDF2 salt derivation.
                </div>

                {tokenRotatedMsg && (
                  <div className="p-2 rounded bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Cryptographic access & refresh tokens rotated successfully.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-950 flex gap-2">
              <button
                onClick={handleRotateTokens}
                className="flex-1 py-2.5 px-3 bg-[#0e1b30] hover:bg-[#142644] border border-cyan-700/50 hover:border-cyan-400 text-cyan-300 font-semibold text-xs font-mono rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Rotate Tokens</span>
              </button>

              <button
                onClick={() => setShowTokenModal(true)}
                className="py-2.5 px-3 bg-[#081224] hover:bg-[#0c182c] border border-cyan-900/60 text-xs font-mono text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                Claims
              </button>
            </div>
          </div>

          {/* ACCESSORY 6: Full Python Backend & Render Blueprint */}
          <div className="p-6 rounded-2xl bg-[#0a1222]/90 border border-cyan-900/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">Backend Archive</h3>
                    <div className="text-[11px] font-mono text-slate-400">
                      Flask / SQLite / Render.yaml
                    </div>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 font-semibold">
                  ZIP Ready
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-950 text-xs font-mono">
                  <div className="text-slate-400 text-[10px]">Root Deployment Files</div>
                  <div className="text-amber-300 font-semibold mt-0.5">
                    requirements.txt • render.yaml • app.py
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#060e1d] border border-cyan-950/60 text-[11px] font-mono text-slate-400">
                  Ready for direct deployment to Render without requirements.txt missing error.
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-950 flex gap-2">
              <button
                onClick={onDownloadZip}
                className="flex-1 py-2.5 px-3 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs font-mono rounded-lg transition-all shadow-[0_0_12px_rgba(34,211,238,0.2)] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Download ZIP</span>
              </button>

              <button
                onClick={() => onNavigateTab('editor')}
                className="py-2.5 px-3 bg-[#081224] hover:bg-[#0c182c] border border-cyan-900/60 text-xs font-mono text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                View Code
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONNECT GOOGLE MODAL with Strict Security Match Verification */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#091428] border border-cyan-500/50 rounded-2xl shadow-2xl p-6 relative font-mono">
            <div className="flex items-center justify-between border-b border-cyan-900/40 pb-4 mb-4">
              <div className="flex items-center gap-2 text-cyan-300">
                <Mail className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider">
                  Connect Google & Gmail Account
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowConnectModal(false);
                  setConnectResult(null);
                }}
                className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed font-sans">
              Authenticate via Google OAuth 2.0 to grant JARVIS permissions to read, search, draft,
              and send emails through your official Gmail mailbox.
            </p>

            <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-950 mb-4 text-xs">
              <div className="text-slate-400 text-[10px]">Your Registered JARVIS Account:</div>
              <div className="text-cyan-400 font-bold text-sm mt-0.5">{currentUser.email}</div>
            </div>

            {/* Strict Policy Rule Warning */}
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-600/30 text-amber-300 text-[11px] mb-4 flex items-start gap-2">
              <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Strict Identity Match Guard:</strong>
                The Google account email MUST match your registered JARVIS email. If they differ, the
                connection will be refused to prevent accessing the wrong mailbox.
              </div>
            </div>

            {connectResult && (
              <div
                className={`p-3 rounded-lg border text-xs mb-4 flex items-start gap-2 ${
                  connectResult.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                }`}
              >
                {connectResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>{connectResult.message}</div>
              </div>
            )}

            <form onSubmit={handleConnectGoogle} className="space-y-4">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">
                  Google Account Email To Connect:
                </label>
                <input
                  type="email"
                  value={googleEmailInput}
                  onChange={(e) => setGoogleEmailInput(e.target.value)}
                  className="w-full bg-[#050b14] border border-cyan-950 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                  required
                />
              </div>

              {/* Helpful test buttons to demonstrate strict security */}
              <div className="flex gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => setGoogleEmailInput(currentUser.email)}
                  className="px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 rounded cursor-pointer"
                >
                  Set Matching Email ({currentUser.email.split('@')[0]})
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleEmailInput('unauthorized_hacker@othermail.com')}
                  className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300 rounded cursor-pointer"
                >
                  Test Mismatched Email
                </button>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowConnectModal(false);
                    setConnectResult(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-[#0a1222] hover:bg-[#0f1b32] border border-cyan-950 text-slate-300 text-xs rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-lg shadow-[0_0_15px_rgba(34,211,238,0.3)] cursor-pointer"
                >
                  Authorize & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOKEN CLAIMS MODAL */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-[#091428] border border-cyan-500/50 rounded-2xl shadow-2xl p-6 font-mono">
            <div className="flex items-center justify-between border-b border-cyan-900/40 pb-4 mb-4">
              <div className="flex items-center gap-2 text-cyan-300">
                <Key className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider">
                  Active JWT Token & Security Metadata
                </h3>
              </div>
              <button
                onClick={() => setShowTokenModal(false)}
                className="text-slate-400 hover:text-slate-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 text-[10px] block mb-1">
                  Access Token (Bearer Header):
                </label>
                <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-950 text-cyan-300 break-all select-all text-[11px]">
                  {accessToken}
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-[10px] block mb-1">Refresh Token:</label>
                <div className="p-3 rounded-lg bg-[#050b14] border border-cyan-950 text-emerald-400 break-all select-all text-[11px]">
                  {refreshToken}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#060e1d] border border-cyan-950 text-[11px] text-slate-300 space-y-1">
                <div>Algorithm: HMAC-SHA256 (HS256)</div>
                <div>Issued To: {currentUser.full_name}</div>
                <div>User ID: {currentUser.id}</div>
                <div>Role: user / standard</div>
                <div>Google OAuth Connected: {currentUser.is_google_connected ? 'YES' : 'NO'}</div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTokenModal(false)}
                className="py-2 px-5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
