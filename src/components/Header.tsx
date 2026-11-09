import React from 'react';
import { Download, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onDownloadZip: () => void;
  isModifiedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onDownloadZip,
  isModifiedCount,
}) => {
  const navItems = [
    { id: 'editor', label: 'Zip Editor' },
    { id: 'diff', label: 'Diff Inspector' },
    { id: 'simulator', label: 'API Simulator' },
    { id: 'services', label: 'Calendar & Gmail' },
    { id: 'android', label: 'Android Spec' },
    { id: 'deploy', label: 'Deploy Guide' },
  ];

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-3.5 border-b border-cyan-900/30 bg-[#050b14]/90 backdrop-blur-md">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); setActiveTab('editor'); }}
        className="font-orbitron text-lg font-bold tracking-wider text-cyan-400 whitespace-nowrap shrink-0 flex items-center gap-2 group"
      >
        <span className="w-2.5 h-2.5 bg-cyan-400 rounded-sm rotate-45 group-hover:scale-125 transition-transform"></span>
        <span>JARVIS STUDIO</span>
        <span className="text-xs font-mono font-normal text-slate-400">v2.0</span>
      </a>

      {/* Zone 2: Single-line text navigation links */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
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
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onDownloadZip}
          className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 active:scale-95 rounded transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download Upgraded ZIP</span>
          {isModifiedCount > 0 && (
            <span className="bg-slate-900 text-cyan-400 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
              {isModifiedCount} modified
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
