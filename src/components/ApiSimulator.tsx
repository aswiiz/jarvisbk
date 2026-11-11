import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Zap,
  Play,
  RotateCcw,
  Smartphone,
  Clock,
  Timer,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Activity,
  Bot,
  User,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { ChatMessage, DeviceAction, AuthUser } from '../types/zip';

interface ApiSimulatorProps {
  currentUser?: AuthUser;
}

export const ApiSimulator: React.FC<ApiSimulatorProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-init',
      role: 'assistant',
      content: `Good day, ${currentUser?.full_name || 'sir'}. All neural providers, user authentication, and Gmail integration endpoints are online. You can say "Check my inbox", "Show unread emails", or "Set a timer for 5 minutes".`,
      provider: 'llm7',
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('auto');
  const [isStreaming, setIsStreaming] = useState(false);
  const [simulateFallback, setSimulateFallback] = useState(false);
  const [fallbackLogs, setFallbackLogs] = useState<string[]>([]);
  const [activeTimers, setActiveTimers] = useState<{ id: string; label: string; remaining: number }[]>([]);
  const [confirmedActions, setConfirmedActions] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleConfirmSendAction = (actionKey: string, recipient: string) => {
    setConfirmedActions((prev) => ({ ...prev, [actionKey]: true }));
    const confMsg: ChatMessage = {
      id: `conf-${Date.now()}`,
      role: 'assistant',
      content: `✅ Email dispatched to ${recipient} via official Gmail API (Message ID: msg-sent-${Date.now().toString(36)}).\nThread ID: th-prod-01.\nStatus: Delivered.`,
      provider: 'gmail_api',
      timestamp: 'Just now',
    };
    setMessages((prev) => [...prev, confMsg]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (activeTimers.length === 0) return;
    const interval = setInterval(() => {
      setActiveTimers((prev) =>
        prev
          .map((t) => ({ ...t, remaining: Math.max(0, t.remaining - 1) }))
          .filter((t) => t.remaining > 0)
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimers]);

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query.trim(),
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsStreaming(true);
    setFallbackLogs([]);

    let usedProvider = selectedProvider === 'auto' ? 'llm7' : selectedProvider;
    const logs: string[] = [];

    if (simulateFallback) {
      logs.push(`[Router] Attempting primary provider 'groq' (llama-3.3-70b)...`);
      logs.push(`[Groq] 429 Too Many Requests - Rate limit exceeded.`);
      logs.push(`[Fallback Router] Engaging secondary provider: 'pollinations' (keyless free tier)...`);
      usedProvider = 'pollinations';
    } else {
      logs.push(`[Router] Dispatching request via ${usedProvider.toUpperCase()} adapter...`);
    }

    setFallbackLogs(logs);

    const qLower = query.toLowerCase();
    const actions: DeviceAction[] = [];
    let assistantReply = '';

    // Email Assistant Requests
    if (qLower.includes('inbox') || qLower.includes('unread email') || qLower.includes('check my email') || qLower.includes('check email')) {
      actions.push({
        type: 'email_action',
        action: 'list_emails',
        category: 'inbox',
        filter: qLower.includes('unread') ? 'unread' : 'all',
      });
      assistantReply = `I have inspected your Gmail inbox for ${currentUser?.email || 'your account'}. You have 1 unread priority message from Professor Sharma regarding the "Campus Placement Drive 2026: Schedule and Shortlist", and an update from GitHub regarding PR #14 merged. Would you like me to read the placement schedule?`;
    } else if (qLower.includes('placement') || qLower.includes('read latest') || qLower.includes('read my latest email')) {
      assistantReply = `Here is your latest email from Professor Sharma (<academics@university.edu>):\n\nSubject: Campus Placement Drive 2026: Schedule and Shortlist\nDate: Today at 09:30 AM\n\n"Dear Students, please find attached the shortlist and interview schedule for the upcoming recruitment drive starting next Monday. All shortlisted candidates must report to Hall 3 by 9:00 AM sharp in business formal attire."\nAttachment: placement_schedule_2026.pdf (245 KB).`;
    } else if (qLower.includes('draft email') || qLower.includes('email to tony') || qLower.includes('send an email')) {
      actions.push({
        type: 'email_action',
        action: 'draft_email',
        recipient: 'tony.stark@avengers.org',
        requires_confirmation: true,
      });
      assistantReply = `I have prepared a draft email to tony.stark@avengers.org with subject "Arc Reactor Telemetry Analysis":\n\n"Tony, all thermal dissipation readings hold at 98.4%. Ready for morning test cycle."\n\nSafety protocol active: Please confirm before final dispatch.`;
    } else if (qLower.includes('timer')) {
      const match = qLower.match(/(\d+)\s*(min|sec)/);
      const val = match ? parseInt(match[1]) : 5;
      const isSec = match && match[2].startsWith('sec');
      const seconds = isSec ? val : val * 60;
      actions.push({
        type: 'device_action',
        action: 'set_timer',
        seconds,
        label: `${val} ${isSec ? 'sec' : 'min'} timer`,
      });
      assistantReply = `Timer initialized for ${val} ${isSec ? 'seconds' : 'minutes'}. Android AlarmClock intent registered.`;
    } else if (qLower.includes('alarm') || qLower.includes('wake me up')) {
      actions.push({
        type: 'device_action',
        action: 'set_alarm',
        time: '06:00 AM',
        label: 'JARVIS Alarm',
      });
      assistantReply = `Alarm scheduled for 06:00 AM. Android AlarmManager will trigger device chime.`;
    } else if (qLower.includes('youtube') || qLower.includes('maps')) {
      const app = qLower.includes('youtube') ? 'youtube' : 'maps';
      actions.push({
        type: 'device_action',
        action: 'open_app',
        app,
      });
      assistantReply = `Dispatching package launch intent for '${app}'. Switching to foreground.`;
    } else {
      assistantReply = `Directive analyzed: "${query}". Neural inference nodes report normal parameters for user ${currentUser?.full_name || 'Owner'}. Standing by for next command.`;
    }

    const asstId = `a-${Date.now()}`;
    const words = assistantReply.split(' ');
    let currentText = '';
    let wordIdx = 0;

    const streamInterval = setInterval(() => {
      if (wordIdx < words.length) {
        currentText += (wordIdx > 0 ? ' ' : '') + words[wordIdx];
        setMessages((prev) => {
          const others = prev.filter((m) => m.id !== asstId);
          return [
            ...others,
            {
              id: asstId,
              role: 'assistant',
              content: currentText,
              provider: usedProvider,
              timestamp: 'Streaming...',
              actions: wordIdx === words.length - 1 ? actions : undefined,
              isStreaming: true,
            },
          ];
        });
        wordIdx++;
      } else {
        clearInterval(streamInterval);
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId ? { ...m, isStreaming: false, timestamp: 'Just now', actions } : m
          )
        );

        actions.forEach((act) => {
          if (act.action === 'set_timer' && act.seconds) {
            setActiveTimers((prev) => [
              ...prev,
              { id: `t-${Date.now()}`, label: act.label || 'Timer', remaining: act.seconds! },
            ]);
          }
        });
      }
    }, 50);
  };

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col bg-[#050b14] text-slate-200 font-mono">
      {/* Top Telemetry Strip */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#08101e] border-b border-cyan-900/30 text-xs">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-200 font-semibold tracking-wide">
            LIVE JARVIS BACKEND &amp; SSE STREAMING SIMULATOR
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-cyan-400">User: {currentUser?.email || 'anonymous'}</span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Provider:</span>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="bg-[#030712] border border-cyan-900 focus:border-cyan-400 rounded px-2 py-1 text-cyan-300 text-xs outline-none"
            >
              <option value="auto">Auto (Configured Fallback Order)</option>
              <option value="llm7">LLM7 (Free Keyless / Default)</option>
              <option value="pollinations">Pollinations.ai (Free Keyless)</option>
              <option value="groq">Groq (Llama 3.3 70B)</option>
              <option value="gemini">Google Gemini 2.5 Flash</option>
              <option value="claude">Anthropic Claude 3.5 Sonnet</option>
              <option value="openai">OpenAI GPT-4o mini</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
            <input
              type="checkbox"
              checked={simulateFallback}
              onChange={(e) => setSimulateFallback(e.target.checked)}
              className="accent-cyan-400"
            />
            <span className="text-[11px] text-amber-300">Simulate Provider Failover</span>
          </label>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Hologram Core & Quick Voice Commands */}
        <aside className="w-80 bg-[#060d1a] border-r border-cyan-900/30 p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div>
            <div className="relative aspect-square rounded-lg border border-cyan-500/30 overflow-hidden mb-4 bg-slate-950 flex items-center justify-center group shadow-[0_0_20px_rgba(34,211,238,0.15)]">
              <img
                src="/src/assets/images/jarvis_hologram_core_1794244586960.jpg"
                alt="JARVIS Arc Reactor Holographic Core"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060d1a] via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 text-center">
                <div className="font-orbitron text-xs font-bold text-cyan-300 tracking-wider">
                  JARVIS AI ASSISTANT
                </div>
                <div className="text-[10px] text-cyan-400/80 mt-0.5">
                  GMAIL &amp; VOICE CHAT CONNECTED
                </div>
              </div>
            </div>

            {/* Quick Test Presets */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Voice &amp; Email Directives
              </div>
              {[
                'Check my inbox for unread emails',
                'Read the email about placement drive',
                'Draft an email to Tony Stark',
                'Wake me up at 6am and set 5 min timer',
                'Open YouTube on device',
              ].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => handleSendMessage(cmd)}
                  disabled={isStreaming}
                  className="w-full text-left px-2.5 py-1.5 bg-[#030610] hover:bg-cyan-950/60 border border-cyan-950 hover:border-cyan-500/40 rounded text-[11px] text-slate-300 transition-colors truncate"
                >
                  "{cmd}"
                </button>
              ))}
            </div>

            {activeTimers.length > 0 && (
              <div className="mt-4 p-3 bg-cyan-950/30 border border-cyan-700/40 rounded space-y-2">
                <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  <span>Android Local Timers Active</span>
                </div>
                {activeTimers.map((t) => (
                  <div key={t.id} className="flex justify-between items-center text-xs">
                    <span className="text-slate-300">{t.label}</span>
                    <span className="text-cyan-400 font-bold tabular-nums">
                      {Math.floor(t.remaining / 60)}:{String(t.remaining % 60).padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {fallbackLogs.length > 0 && (
            <div className="mt-4 p-2.5 bg-black/60 border border-amber-500/30 rounded text-[10px] space-y-1">
              <div className="font-semibold text-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Failover Router Telemetry:</span>
              </div>
              {fallbackLogs.map((log, i) => (
                <div key={i} className="text-slate-400 font-mono text-[9px] leading-tight">
                  {log}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Center: Live Chat Terminal */}
        <div className="flex-1 flex flex-col bg-[#030712] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-3xl ${
                  m.role === 'user' ? 'ml-auto justify-end' : ''
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded bg-cyan-950 border border-cyan-500/40 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-cyan-400" />
                  </div>
                )}
                <div className="space-y-2 max-w-[85%]">
                  <div
                    className={`p-3.5 rounded-lg text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-cyan-950/50 border border-cyan-500/30 text-cyan-100 rounded-br-none'
                        : 'bg-[#060e1d] border border-cyan-900/40 text-slate-200 rounded-bl-none shadow-[0_0_15px_rgba(8,145,178,0.05)]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-cyan-400 ml-1 animate-pulse align-middle" />
                    )}
                  </div>

                  {m.actions && m.actions.length > 0 && (
                    <div className="p-3 bg-slate-900/90 border border-cyan-600/40 rounded-lg space-y-2">
                      <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Action Dispatched to Device / Gmail API:</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                        {m.actions.map((act, i) => {
                          const actionKey = `${m.id}-${i}`;
                          const isConfirmed = confirmedActions[actionKey];

                          return (
                            <div key={i} className="space-y-1.5">
                              <div className="flex items-center justify-between p-2 bg-[#040814] rounded border border-cyan-950">
                                <div className="flex items-center gap-2">
                                  {act.type === 'email_action' && <Mail className="w-3.5 h-3.5 text-cyan-400" />}
                                  {act.action === 'set_timer' && <Timer className="w-3.5 h-3.5 text-cyan-400" />}
                                  {act.action === 'set_alarm' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                                  {act.action === 'open_app' && <Play className="w-3.5 h-3.5 text-emerald-400" />}
                                  <span className="text-slate-200 font-semibold">{act.action}</span>
                                </div>
                                <span className="text-cyan-400 font-mono text-[10px]">
                                  {JSON.stringify(act).slice(0, 45)}...
                                </span>
                              </div>

                              {act.requires_confirmation && (
                                <div className="p-2 bg-amber-950/50 border border-amber-500/40 rounded flex items-center justify-between gap-2 text-xs">
                                  <span className="text-[10px] text-amber-200">
                                    Safety Guard: Explicit confirmation required before Gmail dispatch.
                                  </span>
                                  {isConfirmed ? (
                                    <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleConfirmSendAction(actionKey, act.recipient || 'recipient')}
                                      className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[10px] rounded transition-colors cursor-pointer"
                                    >
                                      Confirm & Send
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{m.timestamp}</span>
                    {m.provider && (
                      <>
                        <span>·</span>
                        <span className="text-cyan-400/90 font-bold uppercase">{m.provider}</span>
                      </>
                    )}
                  </div>
                </div>
                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-cyan-900/30 bg-[#050b16]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask JARVIS (e.g. 'Check my inbox', 'Show unread emails', 'Set a 10 min timer')..."
                className="flex-1 bg-[#02050e] border border-cyan-900/70 focus:border-cyan-400 rounded-lg px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none transition-colors"
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={isStreaming || !inputText.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 font-semibold text-xs rounded-lg transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
