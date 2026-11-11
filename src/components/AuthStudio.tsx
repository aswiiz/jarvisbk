import React, { useState } from 'react';
import {
  Shield,
  Key,
  UserCheck,
  UserPlus,
  LogIn,
  LogOut,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Mail,
  Lock,
  User,
  Users,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { AuthUser } from '../types/zip';

interface AuthStudioProps {
  currentUser: AuthUser;
  setCurrentUser: (user: AuthUser) => void;
  accessToken: string;
  setAccessToken: (token: string) => void;
  refreshToken: string;
  setRefreshToken: (token: string) => void;
}

export const AuthStudio: React.FC<AuthStudioProps> = ({
  currentUser,
  setCurrentUser,
  accessToken,
  setAccessToken,
  refreshToken,
  setRefreshToken,
}) => {
  const [authMode, setAuthMode] = useState<'profile' | 'register' | 'login'>('profile');
  const [regName, setRegName] = useState('Bruce Wayne');
  const [regEmail, setRegEmail] = useState('bruce@wayne.corp');
  const [regPassword, setRegPassword] = useState('BatCavePassword2026!');
  const [regConfirmPassword, setRegConfirmPassword] = useState('BatCavePassword2026!');

  const [loginEmail, setLoginEmail] = useState('tony@stark.com');
  const [loginPassword, setLoginPassword] = useState('IronManPassword2026!');

  const [googleConnectEmail, setGoogleConnectEmail] = useState(currentUser.email);
  const [googleStatusMsg, setGoogleStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Pre-configured mock users for testing user isolation
  const presetUsers: AuthUser[] = [
    {
      id: 'usr_stark_01',
      full_name: 'Tony Stark',
      email: 'tony@stark.com',
      is_verified: true,
      is_google_connected: true,
      google_email: 'tony@stark.com',
    },
    {
      id: 'usr_parker_02',
      full_name: 'Peter Parker',
      email: 'student@jarvis.ai',
      is_verified: true,
      is_google_connected: true,
      google_email: 'student@jarvis.ai',
    },
    {
      id: 'usr_guest_03',
      full_name: 'Dr. Bruce Banner',
      email: 'banner@avengers.org',
      is_verified: false,
      is_google_connected: false,
    },
  ];

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      setStatusMsg('Error: Passwords do not match');
      return;
    }
    const newUser: AuthUser = {
      id: `usr_${Date.now().toString(36)}`,
      full_name: regName,
      email: regEmail.toLowerCase(),
      is_verified: true,
      is_google_connected: false,
    };
    setCurrentUser(newUser);
    setAccessToken(`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke25ld1VzZXIuaWR9IiwiZW1haWwiOiIke25ld1VzZXIuZW1haWx9IiwidHlwZSI6ImFjY2VzcyJ9.mock_sig_${Date.now()}`);
    setRefreshToken(`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke25ld1VzZXIuaWR9IiwidHlwZSI6InJlZnJlc2gifQ.mock_ref_${Date.now()}`);
    setGoogleConnectEmail(newUser.email);
    setStatusMsg(`User ${regName} registered and logged in successfully.`);
    setAuthMode('profile');
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = presetUsers.find((u) => u.email === loginEmail) || {
      id: `usr_${Date.now().toString(36)}`,
      full_name: loginEmail.split('@')[0],
      email: loginEmail,
      is_verified: true,
      is_google_connected: false,
    };
    setCurrentUser(found);
    setAccessToken(`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke2ZvdW5kLmlkfSIsImVtYWlsIjoiJHpmb3VuZC5lbWFpbH0iLCJ0eXBlIjoiYWNjZXNzIn0.mock_sig_${Date.now()}`);
    setRefreshToken(`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke2ZvdW5kLmlkfSIsInR5cGUiOiJyZWZyZXNoIn0.mock_ref_${Date.now()}`);
    setGoogleConnectEmail(found.email);
    setStatusMsg(`Logged in as ${found.full_name} (${found.email}).`);
    setAuthMode('profile');
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleGoogleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleStatusMsg(null);

    // CRITICAL VALIDATION CHECK from prompt:
    if (googleConnectEmail.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
      setGoogleStatusMsg({
        type: 'error',
        text: `Security Policy Violation: Connected Google email (${googleConnectEmail}) does NOT match your registered JARVIS email (${currentUser.email}). Connection rejected to prevent accessing the wrong mailbox.`,
      });
      return;
    }

    // Match succeeded
    setCurrentUser({
      ...currentUser,
      is_google_connected: true,
      google_email: googleConnectEmail.trim().toLowerCase(),
    });
    setGoogleStatusMsg({
      type: 'success',
      text: `Google account ${googleConnectEmail} connected successfully with Gmail Modify and Calendar scopes.`,
    });
  };

  const handleDisconnectGoogle = () => {
    setCurrentUser({
      ...currentUser,
      is_google_connected: false,
      google_email: undefined,
    });
    setGoogleStatusMsg({
      type: 'success',
      text: 'Google account disconnected and tokens revoked from backend.',
    });
  };

  const handleSwitchUser = (user: AuthUser) => {
    setCurrentUser(user);
    setGoogleConnectEmail(user.email);
    setGoogleStatusMsg(null);
    setAccessToken(`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIke3VzZXIuaWR9IiwiZW1haWwiOiIke3VzZXIuZW1haWx9IiwidHlwZSI6ImFjY2VzcyJ9.mock_sig_${Date.now()}`);
    setStatusMsg(`Switched to active user: ${user.full_name} (${user.email}). Notice user mailbox isolation!`);
    setTimeout(() => setStatusMsg(null), 3500);
  };

  return (
    <div className="h-[calc(100vh-60px)] overflow-y-auto p-6 max-w-6xl mx-auto w-full text-slate-200 font-mono space-y-6">
      {/* Title Header */}
      <div className="border-b border-cyan-900/30 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span>JARVIS Multi-User Authentication &amp; Google OAuth Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            JWT Token Management, User Isolation, and Google OAuth with Strict Email Matching Protection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {presetUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => handleSwitchUser(u)}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                currentUser.email === u.email
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-bold'
                  : 'bg-[#08101e] text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {u.full_name}
            </button>
          ))}
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-cyan-950/60 border border-cyan-500/40 rounded text-xs text-cyan-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Main Grid: User Profile & Google OAuth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Authenticated User Session & Tokens */}
        <div className="p-5 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-900/20 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                Active User Profile
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuthMode('login')}
                className="text-[11px] text-slate-400 hover:text-cyan-300 transition-colors"
              >
                Switch Login
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => setAuthMode('register')}
                className="text-[11px] text-slate-400 hover:text-cyan-300 transition-colors"
              >
                New User
              </button>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 bg-[#030610] rounded border border-cyan-950">
              <span className="text-slate-500">Full Name:</span>
              <span className="text-slate-200 font-bold">{currentUser.full_name}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-[#030610] rounded border border-cyan-950">
              <span className="text-slate-500">JARVIS Email:</span>
              <span className="text-cyan-300 font-bold">{currentUser.email}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-[#030610] rounded border border-cyan-950">
              <span className="text-slate-500">User ID:</span>
              <span className="text-slate-400 text-[11px]">{currentUser.id}</span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-[#030610] rounded border border-cyan-950">
              <span className="text-slate-500">Verification Status:</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified</span>
              </span>
            </div>
          </div>

          {/* JWT Token Display */}
          <div className="pt-2 space-y-2 border-t border-cyan-900/20">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                <Key className="w-3.5 h-3.5 text-cyan-400" />
                <span>JWT Access Token (1 Hour Expiry)</span>
              </span>
              <span className="text-emerald-400 text-[10px]">ACTIVE</span>
            </div>
            <pre className="p-2.5 bg-[#03050e] rounded border border-cyan-950 text-[10px] text-cyan-400/90 break-all select-all">
              {accessToken}
            </pre>
          </div>
        </div>

        {/* Right Card: Google OAuth Connection & Email Match Validation */}
        <div className="p-5 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-900/20 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                Google Account OAuth 2.0
              </span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                currentUser.is_google_connected
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-slate-900 text-slate-400 border border-slate-700'
              }`}
            >
              {currentUser.is_google_connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          {currentUser.is_google_connected ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-950/30 border border-emerald-700/40 rounded space-y-2">
                <div className="text-emerald-300 font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Google Account Linked &amp; Verified</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Connected mailbox: <strong className="text-slate-200">{currentUser.google_email}</strong>
                </p>
                <div className="text-[10px] text-slate-500">
                  Scopes: gmail.modify, gmail.send, calendar, userinfo.email
                </div>
              </div>

              <button
                onClick={handleDisconnectGoogle}
                className="w-full py-2 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded text-xs transition-colors"
              >
                Disconnect Google Account &amp; Revoke Tokens
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your Google account to grant JARVIS access to your Gmail mailbox and Calendar.
              </p>

              <form onSubmit={handleGoogleConnect} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Google Email to Connect:</label>
                  <input
                    type="email"
                    value={googleConnectEmail}
                    onChange={(e) => setGoogleConnectEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full bg-[#030610] border border-cyan-950 focus:border-cyan-400 rounded p-2 text-slate-200 outline-none"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Security Rule: Must strictly match your JARVIS email (<span className="text-cyan-400">{currentUser.email}</span>).
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded transition-colors"
                  >
                    Connect Google Account (OAuth)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGoogleConnectEmail('mismatch_hacker@gmail.com')}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] rounded transition-colors"
                    title="Simulate mismatch error"
                  >
                    Test Mismatch
                  </button>
                </div>
              </form>
            </div>
          )}

          {googleStatusMsg && (
            <div
              className={`p-3 rounded text-xs leading-relaxed flex items-start gap-2 ${
                googleStatusMsg.type === 'error'
                  ? 'bg-rose-950/60 border border-rose-700/60 text-rose-200'
                  : 'bg-emerald-950/60 border border-emerald-700/60 text-emerald-200'
              }`}
            >
              {googleStatusMsg.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <span>{googleStatusMsg.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Registration & Login Modals / Panels */}
      {authMode === 'register' && (
        <div className="p-5 bg-[#08101e] border border-cyan-500/40 rounded-lg space-y-4 max-w-xl mx-auto shadow-2xl">
          <div className="flex items-center justify-between border-b border-cyan-900/30 pb-2">
            <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              <span>Register New JARVIS User</span>
            </h3>
            <button onClick={() => setAuthMode('profile')} className="text-slate-400 hover:text-white text-xs">
              ✕ Close
            </button>
          </div>
          <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Full Name:</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full bg-[#030610] border border-cyan-950 rounded p-2 text-slate-200 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Email Address:</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full bg-[#030610] border border-cyan-950 rounded p-2 text-slate-200 outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Password:</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-[#030610] border border-cyan-950 rounded p-2 text-slate-200 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Confirm Password:</label>
                <input
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full bg-[#030610] border border-cyan-950 rounded p-2 text-slate-200 outline-none"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded transition-colors"
            >
              Create Account
            </button>
          </form>
        </div>
      )}

      {authMode === 'login' && (
        <div className="p-5 bg-[#08101e] border border-cyan-500/40 rounded-lg space-y-4 max-w-md mx-auto shadow-2xl">
          <div className="flex items-center justify-between border-b border-cyan-900/30 pb-2">
            <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
              <LogIn className="w-4 h-4" />
              <span>Login to JARVIS</span>
            </h3>
            <button onClick={() => setAuthMode('profile')} className="text-slate-400 hover:text-white text-xs">
              ✕ Close
            </button>
          </div>
          <form onSubmit={handleLoginSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Registered Email:</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-[#030610] border border-cyan-950 rounded p-2 text-slate-200 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Password:</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-[#030610] border border-cyan-950 rounded p-2 text-slate-200 outline-none"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded transition-colors"
            >
              Authenticate &amp; Issue Tokens
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
