import React from 'react';
import { Download, Sparkles, User, Shield } from 'lucide-react';
import { AuthUser } from '../types/zip';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onDownloadZip: () => void;
  isModifiedCount: number;
  currentUser?: AuthUser;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onDownloadZip,
  isModifiedCount,
  currentUser,
  onLogout,
}) => {
  const navItems = [
    { id: 'accessories', label: 'Accessories & Hub' },
    { id: 'gmail', label: 'Gmail Mailbox' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'simulator', label: 'Voice AI' },
    { id: 'editor', label: 'Zip Code' },
    { id: 'diff', label: 'Diff' },
    { id: 'android', label: 'Android Spec' },
    { id: 'deploy', label: 'Deploy' },
  ];

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-6 px-6 py-3 border-b border-cyan-900/30 bg-[#050b14]/90 backdrop-blur-md">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab('accessories');
        }}
        className="font-orbitron text-lg font-bold tracking-wider text-cyan-400 whitespace-nowrap shrink-0 flex items-center gap-2 group"
      >
        <span className="w-2.5 h-2.5 bg-cyan-400 rounded-sm rotate-45 group-hover:scale-125 transition-transform" />
        <span>JARVIS TERMINAL</span>
        <span className="text-[10px] font-mono font-normal text-cyan-300 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800">
          v2.1
        </span>
      </a>

      {/* Zone 2: Single-line text navigation links */}
      <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-300">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`transition-colors whitespace-nowrap shrink-0 relative py-1 text-xs uppercase tracking-wider font-mono ${
                isActive
                  ? 'text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
              {item.id === 'gmail' && currentUser?.is_google_connected && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action & user profile badge */}
      <div className="flex items-center gap-3 shrink-0">
        {currentUser && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('accessories')}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-[#08101e] border border-cyan-950 hover:border-cyan-500/40 rounded text-xs text-slate-300 font-mono transition-colors cursor-pointer"
              title={`Logged in as ${currentUser.full_name} (${currentUser.email})`}
            >
              <div className="w-5 h-5 rounded-full bg-cyan-400/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 text-[10px] font-bold">
                {currentUser.full_name[0]?.toUpperCase() || 'U'}
              </div>
              <span className="truncate max-w-[120px] font-semibold text-slate-200">
                {currentUser.full_name}
              </span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="px-2 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-xs font-mono rounded transition-colors cursor-pointer"
                title="Sign Out"
              >
                Sign Out
              </button>
            )}
          </div>
        )}

        <button
          onClick={onDownloadZip}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 active:scale-95 rounded transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Upgraded ZIP</span>
          {isModifiedCount > 0 && (
            <span className="bg-slate-900 text-cyan-400 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
              {isModifiedCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
