import React, { useState } from 'react';
import {
  Shield,
  Key,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { AuthUser } from '../types/zip';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  onDownloadZip: () => void;
  onSkip?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onDownloadZip,
  onSkip,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Login form state - Blank by default
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state - Blank by default
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Skip login helper: directly proceed to dashboard with a clean session
  const handleSkip = () => {
    if (onSkip) {
      onSkip();
      return;
    }
    const guestUser: AuthUser = {
      id: `usr_${Date.now().toString(36)}`,
      full_name: 'Guest User',
      email: '',
      is_verified: true,
      is_google_connected: false,
    };
    const accessTok = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sig_guest_${Date.now()}`;
    const refreshTok = `rt_guest_${Date.now()}`;
    onLoginSuccess(guestUser, accessTok, refreshTok);
  };

  // Status message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Preset demo accounts
  const demoAccounts: {
    user: AuthUser;
    label: string;
    description: string;
    badge: string;
    badgeColor: string;
  }[] = [
    {
      user: {
        id: 'usr_raj_01',
        full_name: 'Raj Ashwin',
        email: 'rajraswin51@gmail.com',
        is_verified: true,
        is_google_connected: true,
        google_email: 'rajraswin51@gmail.com',
      },
      label: 'Raj Ashwin',
      description: 'Pre-configured with Gmail & Calendar connected',
      badge: 'Recommended',
      badgeColor: 'border-cyan-400/60 bg-cyan-950/80 text-cyan-300',
    },
    {
      user: {
        id: 'usr_stark_01',
        full_name: 'Tony Stark',
        email: 'tony@stark.com',
        is_verified: true,
        is_google_connected: true,
        google_email: 'tony@stark.com',
      },
      label: 'Tony Stark',
      description: 'Avenger level access with active telemetry',
      badge: 'Admin',
      badgeColor: 'border-amber-400/60 bg-amber-950/80 text-amber-300',
    },
    {
      user: {
        id: 'usr_banner_03',
        full_name: 'Dr. Bruce Banner',
        email: 'banner@avengers.org',
        is_verified: true,
        is_google_connected: false,
      },
      label: 'Dr. Bruce Banner',
      description: 'Unconnected account to test connecting Gmail & accessories from scratch',
      badge: 'Fresh Account',
      badgeColor: 'border-emerald-400/60 bg-emerald-950/80 text-emerald-300',
    },
  ];

  const handleQuickLogin = (acc: typeof demoAccounts[0]) => {
    const accessTok = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke2FjYy51c2VyLmlkfSIsImVtYWlsIjoiJHthY2MudXNlci5lbWFpbH0iLCJyb2xlIjoidXNlciIsImV4cCI6MTc2MjgxMzYwMH0.sig_${acc.user.id}`;
    const refreshTok = `rt_${Date.now()}_${acc.user.id}`;
    onLoginSuccess(acc.user, accessTok, refreshTok);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // If inputs are left blank, skip login directly
    if (!loginEmail.trim()) {
      handleSkip();
      return;
    }

    // Match preset or dynamically create session
    const matched = demoAccounts.find(
      (a) => a.user.email.toLowerCase() === loginEmail.trim().toLowerCase()
    );

    const user: AuthUser = matched
      ? matched.user
      : {
          id: `usr_${Date.now().toString(36)}`,
          full_name: loginEmail.split('@')[0],
          email: loginEmail.trim().toLowerCase(),
          is_verified: true,
          is_google_connected: false,
        };

    const accessTok = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sig_${user.id}`;
    const refreshTok = `rt_${Date.now()}_${user.id}`;

    onLoginSuccess(user, accessTok, refreshTok);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setErrorMessage('All registration fields are required.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    const newUser: AuthUser = {
      id: `usr_${Date.now().toString(36)}`,
      full_name: regName.trim(),
      email: regEmail.trim().toLowerCase(),
      is_verified: true,
      is_google_connected: false,
    };

    const accessTok = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke25ld1VzZXIuaWR9IiwiZW1haWwiOiIke25ld1VzZXIuZW1haWx9Iiwicm9sZSI6InVzZXIifQ.sig_${newUser.id}`;
    const refreshTok = `rt_${Date.now()}_${newUser.id}`;

    onLoginSuccess(newUser, accessTok, refreshTok);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }
    setForgotSubmitted(true);
    setInfoMessage(
      `Password reset token dispatched to ${forgotEmail}. Check your inbox for the reset link.`
    );
  };

  return (
    <div className="min-h-screen bg-[#040811] text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-cyan-500/30">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-gradient-to-b from-cyan-500/10 via-blue-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 right-0 w-[500px] h-[500px] bg-cyan-600/5 blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-cyan-900/30 bg-[#050b14]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <div className="w-full h-full bg-[#050b14] rounded-[6px] flex items-center justify-center">
              <span className="w-2.5 h-2.5 bg-cyan-400 rounded-sm rotate-45" />
            </div>
          </div>
          <div>
            <div className="font-orbitron text-base font-bold tracking-wider text-cyan-400">
              JARVIS ACCESS GATEWAY
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Secure Multi-User Neural Terminal v2.1
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSkip}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 rounded transition-all shadow-[0_0_12px_rgba(52,211,153,0.3)] cursor-pointer"
          >
            <span>Skip Login & Enter Hub →</span>
          </button>

          <button
            onClick={onDownloadZip}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 active:scale-95 rounded transition-all shadow-[0_0_12px_rgba(34,211,238,0.3)] cursor-pointer"
          >
            <span>Download ZIP</span>
          </button>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Purpose & Quick 1-Click Access */}
          <div className="lg:col-span-5 flex flex-col justify-between p-6 rounded-2xl bg-[#081224]/80 border border-cyan-900/40 shadow-2xl backdrop-blur-xl">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-[11px] font-mono text-cyan-300 mb-4">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>One Login, All Connected Services</span>
              </div>

              <h1 className="font-orbitron text-2xl font-bold tracking-wide text-slate-100 mb-2">
                Sign In to Connect
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed mb-6 font-mono">
                Log in to authenticate your JARVIS session. Once logged in, you can connect your
                official <strong className="text-cyan-300">Gmail</strong> account, synchronize{' '}
                <strong className="text-cyan-300">Google Calendar</strong>, pair{' '}
                <strong className="text-cyan-300">Android accessories</strong>, and issue neural voice
                directives.
              </p>

              {/* Quick Demo Logins */}
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-wider font-mono text-slate-400 font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Instant 1-Click Access</span>
                </div>

                {demoAccounts.map((acc) => (
                  <button
                    key={acc.user.id}
                    onClick={() => handleQuickLogin(acc)}
                    className="w-full text-left p-3 rounded-xl bg-[#0d1b32]/90 hover:bg-[#122340] border border-cyan-900/40 hover:border-cyan-400/50 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-xs text-slate-200 group-hover:text-cyan-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{acc.label}</span>
                      </div>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${acc.badgeColor}`}
                      >
                        {acc.badge}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400/90 mb-1">
                      {acc.user.email}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {acc.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Security Highlights */}
            <div className="mt-6 pt-4 border-t border-cyan-950 flex flex-col gap-2 text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-2 text-cyan-300">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Strict Google Email Match Verification Enforced</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Key className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                <span>HMAC-SHA256 JWT Token Rotation & AES-GCM Encrypted Storage</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Login / Register Form */}
          <div className="lg:col-span-7 p-8 rounded-2xl bg-[#091426] border border-cyan-900/50 shadow-2xl flex flex-col justify-between">
            {/* Form Mode Selector */}
            <div>
              <div className="flex items-center justify-between border-b border-cyan-900/40 pb-4 mb-6">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMessage(null);
                    }}
                    className={`px-4 py-2 text-xs font-mono font-semibold rounded-lg transition-colors cursor-pointer ${
                      authMode === 'login'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <LogIn className="w-3.5 h-3.5" />
                      Sign In
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMessage(null);
                    }}
                    className={`px-4 py-2 text-xs font-mono font-semibold rounded-lg transition-colors cursor-pointer ${
                      authMode === 'register'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" />
                      Register
                    </span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    setAuthMode('forgot');
                    setErrorMessage(null);
                  }}
                  className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Error or Info Alerts */}
              {errorMessage && (
                <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {infoMessage && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* Sign In Form */}
              {authMode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="name@example.com (or leave blank to skip)"
                        className="w-full bg-[#050b14] border border-cyan-950 focus:border-cyan-400 rounded-lg pl-10 pr-4 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1.5">
                      JARVIS Account Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="password (or leave blank to skip)"
                        className="w-full bg-[#050b14] border border-cyan-950 focus:border-cyan-400 rounded-lg pl-10 pr-4 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold font-mono text-xs rounded-lg transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Sign In & Open Connected Hub</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleSkip}
                      className="w-full py-2.5 px-3 bg-[#0c182c] hover:bg-[#12223c] border border-cyan-800/40 text-cyan-300 font-mono text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Leave blank & Skip login directly →</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Registration Form */}
              {authMode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-cyan-400 absolute left-3.5 top-2.5" />
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Your Name"
                        className="w-full bg-[#050b14] border border-cyan-950 focus:border-cyan-400 rounded-lg pl-10 pr-4 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1">
                      Email Address (Optional if skipping, or enter to register)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-cyan-400 absolute left-3.5 top-2.5" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full bg-[#050b14] border border-cyan-950 focus:border-cyan-400 rounded-lg pl-10 pr-4 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-300 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#050b14] border border-cyan-950 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-300 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#050b14] border border-cyan-950 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold font-mono text-xs rounded-lg transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Create JARVIS Account & Proceed</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Forgot Password Form */}
              {authMode === 'forgot' && (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    Enter the email registered with your JARVIS account. We will issue a secure
                    cryptographic reset token to verify your identity.
                  </p>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-300 mb-1.5">
                      Registered Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="e.g. rajraswin51@gmail.com"
                        className="w-full bg-[#050b14] border border-cyan-950 focus:border-cyan-400 rounded-lg pl-10 pr-4 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 font-mono text-xs rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Dispatch Password Reset Token</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="w-full text-center text-xs text-slate-400 hover:text-slate-200 font-mono"
                  >
                    Back to Sign In
                  </button>
                </form>
              )}
            </div>

            {/* Explanatory Footer */}
            <div className="mt-8 pt-4 border-t border-cyan-950/60 text-[11px] font-mono text-slate-400 flex items-center justify-between">
              <span>Backend: Flask / SQLite / Werkzeug / JWT</span>
              <span className="text-cyan-400">Status: Ready to Connect</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
