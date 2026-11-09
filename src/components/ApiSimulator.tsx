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
  ExternalLink,
} from 'lucide-react';
import { ChatMessage, DeviceAction } from '../types/zip';

export const ApiSimulator: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-init',
      role: 'assistant',
      content: 'Good day, sir. All core sub-routines and neural provider adapters are operational. How may I assist you today?',
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Timer countdown hook
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

    // Determine simulated provider and actions based on natural language
    let usedProvider = selectedProvider === 'auto' ? 'llm7' : selectedProvider;
    const logs: string[] = [];

    if (simulateFallback) {
      logs.push(`[Router] Attempting primary provider 'groq' (model: llama-3.3-70b)...`);
      logs.push(`[Groq] 429 Too Many Requests - Transient rate limit detected.`);
      logs.push(`[Circuit Breaker] Setting 30s cooldown for 'groq'.`);
      logs.push(`[Fallback] Engaging secondary provider: 'pollinations' (keyless free tier)...`);
      usedProvider = 'pollinations';
    } else {
      logs.push(`[Router] Dispatching request via ${usedProvider.toUpperCase()} adapter...`);
    }

    setFallbackLogs(logs);

    // Extract device actions
    const qLower = query.toLowerCase();
    const actions: DeviceAction[] = [];
    let assistantReply = '';

    if (qLower.includes('timer')) {
      const match = qLower.match(/(\d+)\s*(min|sec)/);
      const val = match ? parseInt(match[1]) : 5;
      const isSec = match && match[2].startsWith('sec');
      const seconds = isSec ? val : val * 60;
      actions.push({
        type: 'device_action',
        action: 'set_timer',
        seconds,
        label: `${val} ${isSec ? 'second' : 'minute'} timer`,
      });
      assistantReply = `I have initialized a countdown timer for ${val} ${isSec ? 'seconds' : 'minutes'}. It will notify you as soon as the interval elapses.`;
    } else if (qLower.includes('alarm') || qLower.includes('wake me up')) {
      const timeMatch = qLower.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/);
      const timeStr = timeMatch ? timeMatch[1] : '06:00 AM';
      actions.push({
        type: 'device_action',
        action: 'set_alarm',
        time: timeStr,
        label: 'Morning Alarm',
      });
      assistantReply = `Alarm calibrated for ${timeStr}. The Android AlarmManager hook has been registered locally.`;
    } else if (qLower.includes('youtube') || qLower.includes('spotify') || qLower.includes('camera') || qLower.includes('maps')) {
      const app = qLower.includes('youtube') ? 'youtube' : qLower.includes('spotify') ? 'spotify' : qLower.includes('maps') ? 'maps' : 'camera';
      actions.push({
        type: 'device_action',
        action: 'open_app',
        app,
      });
      assistantReply = `Dispatching package launch intent for '${app}'. Switching to foreground.`;
    } else if (qLower.includes('calendar') || qLower.includes('schedule') || qLower.includes('tomorrow')) {
      assistantReply = `Checking your schedule for tomorrow in Asia/Kolkata timezone: You have the Project Review Meeting at 10:00 AM, followed by the JARVIS Architecture Sync at 2:00 PM. No scheduling conflicts detected.`;
    } else if (qLower.includes('email') || qLower.includes('tony')) {
      assistantReply = `Drafted message to tony.stark@avengers.org: 'Arc Reactor telemetry validated at 98.4% efficiency'. Security rule active: please confirm before final dispatch.`;
    } else if (qLower.includes('airport') || qLower.includes('navigate')) {
      actions.push({
        type: 'device_action',
        action: 'open_maps',
        query: 'Airport',
      });
      assistantReply = `Routing intent calculated. Passing coordinates to Android Google Maps navigation intent.`;
    } else {
      assistantReply = `I have analyzed your query: "${query}". All neural inference nodes report normal parameters. Standing by for further directives.`;
    }

    // Stream the response tokens simulate SSE
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
            m.id === asstId
              ? { ...m, isStreaming: false, timestamp: 'Just now', actions }
              : m
          )
        );

        // Add any timer to active timers
        actions.forEach((act) => {
          if (act.action === 'set_timer' && act.seconds) {
            setActiveTimers((prev) => [
              ...prev,
              { id: `t-${Date.now()}`, label: act.label || 'Timer', remaining: act.seconds! },
            ]);
          }
        });
      }
    }, 55);
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
          <span className="text-cyan-400">Endpoint: POST /api/chat/stream</span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">AI Provider:</span>
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
            <span className="text-[11px] text-amber-300">Simulate Rate-Limit Failover</span>
          </label>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Hologram Core & Telemetry Console */}
        <aside className="w-80 bg-[#060d1a] border-r border-cyan-900/30 p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div>
            {/* Holographic HUD Graphic */}
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
                  JARVIS NEURAL CORE
                </div>
                <div className="text-[10px] text-cyan-400/80 mt-0.5">
                  SSE STREAM READY · 100% ONLINE
                </div>
              </div>
            </div>

            {/* Quick Test Presets */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Sample Voice Commands
              </div>
              {[
                'Wake me up at 6am and set 5 min timer',
                'Open YouTube on device',
                'Check schedule for tomorrow',
                'Draft email to Tony Stark',
                'Navigate to Airport',
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

            {/* Active Android Timers Widget */}
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

          {/* Router Failover Event Log */}
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
          {/* Chat Messages */}
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

                  {/* Android Structured Actions Card if attached */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="p-3 bg-slate-900/90 border border-cyan-600/40 rounded-lg space-y-2">
                      <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Android Intent Dispatched to Device:</span>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                        {m.actions.map((act, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2 bg-[#040814] rounded border border-cyan-950"
                          >
                            <div className="flex items-center gap-2">
                              {act.action === 'set_timer' && <Timer className="w-3.5 h-3.5 text-cyan-400" />}
                              {act.action === 'set_alarm' && <Clock className="w-3.5 h-3.5 text-amber-400" />}
                              {act.action === 'open_app' && <Play className="w-3.5 h-3.5 text-emerald-400" />}
                              {act.action === 'open_maps' && <Navigation className="w-3.5 h-3.5 text-sky-400" />}
                              <span className="text-slate-200 font-semibold">{act.action}</span>
                            </div>
                            <span className="text-cyan-400 font-mono text-[10px]">
                              {JSON.stringify(act).slice(0, 45)}...
                            </span>
                          </div>
                        ))}
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

          {/* Input Box */}
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
                placeholder="Talk to JARVIS (e.g. 'Set a timer for 10 minutes', 'Open maps')..."
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
