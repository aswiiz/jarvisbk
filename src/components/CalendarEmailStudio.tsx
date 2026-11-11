import React, { useState } from 'react';
import {
  Calendar,
  Mail,
  Clock,
  Plus,
  Trash2,
  Send,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Inbox,
  FileCheck,
} from 'lucide-react';
import { CalendarEvent, EmailMessage } from '../types/zip';

export const CalendarEmailStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'email'>('calendar');

  // Calendar State
  const [events, setEvents] = useState<CalendarEvent[]>([
    {
      id: 'evt-101',
      summary: 'Project Review Meeting',
      start: '2026-11-10T10:00:00+05:30',
      end: '2026-11-10T11:00:00+05:30',
      location: 'Main Conference Room / Online',
      description: 'Weekly milestone review with the engineering team.',
    },
    {
      id: 'evt-102',
      summary: 'JARVIS Architecture Sync',
      start: '2026-11-11T14:00:00+05:30',
      end: '2026-11-11T15:00:00+05:30',
      location: 'Discord / Google Meet',
      description: 'Discuss provider fallbacks and Android client integration.',
    },
  ]);
  const [newSummary, setNewSummary] = useState('');
  const [newStart, setNewStart] = useState('2026-11-12T15:00');
  const [newLocation, setNewLocation] = useState('Virtual');
  const [calendarAlert, setCalendarAlert] = useState<string | null>(null);

  // Email State
  const [emails, setEmails] = useState<EmailMessage[]>([
    {
      id: 'msg-001',
      sender: 'tony.stark@avengers.org',
      recipient: 'user@jarvis.ai',
      subject: 'Arc Reactor Telemetry Update',
      snippet: 'Check out the latest thermal efficiency readings on the new mark...',
      body: 'Jarvis, review the thermal outputs from the morning test cycle. Efficiency is at 98.4%.',
      body_plain: 'Jarvis, review the thermal outputs from the morning test cycle. Efficiency is at 98.4%.',
      body_html: '<p>Jarvis, review the thermal outputs from the morning test cycle. Efficiency is at <strong>98.4%</strong>.</p>',
      date: '2026-11-09 14:32:00',
      is_unread: true,
      is_starred: true,
      labels: ['INBOX', 'IMPORTANT'],
      attachments: [],
      status: 'inbox',
    },
    {
      id: 'msg-002',
      sender: 'notifications@github.com',
      recipient: 'user@jarvis.ai',
      subject: '[GitHub] Security update for python dependencies',
      snippet: 'Dependabot detected 0 vulnerabilities in the latest build.',
      body: 'All automated security audits passed successfully for the JARVIS backend repository.',
      body_plain: 'All automated security audits passed successfully for the JARVIS backend repository.',
      body_html: '<p>All automated security audits passed successfully for the JARVIS backend repository.</p>',
      date: '2026-11-09 10:15:00',
      is_unread: false,
      is_starred: false,
      labels: ['INBOX'],
      attachments: [],
      status: 'inbox',
    },
  ]);
  const [draftRecipient, setDraftRecipient] = useState('pepper.potts@starkindustries.com');
  const [draftSubject, setDraftSubject] = useState('JARVIS Android Client Deployment');
  const [draftBody, setDraftBody] = useState(
    'Pepper, the v2.0 backend with SSE streaming and Android APK intent contracts has passed all integration tests. Ready for rollout.'
  );
  const [confirmStep, setConfirmStep] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSummary.trim()) return;

    // Check conflict
    const conflict = events.find((evt) => evt.start.startsWith(newStart));
    if (conflict) {
      setCalendarAlert(`Warning: Overlaps with existing event "${conflict.summary}"! Created anyway.`);
    } else {
      setCalendarAlert(`Event "${newSummary}" added successfully.`);
    }

    const newEvt: CalendarEvent = {
      id: `evt-${Date.now()}`,
      summary: newSummary,
      start: `${newStart}:00+05:30`,
      end: `${newStart}:00+05:30`,
      location: newLocation,
    };
    setEvents([...events, newEvt]);
    setNewSummary('');
    setTimeout(() => setCalendarAlert(null), 4000);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  const handleSendEmailInitiate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftRecipient.trim() || !draftSubject.trim()) return;
    setConfirmStep(true);
  };

  const handleConfirmSend = () => {
    const sentMsg: EmailMessage = {
      id: `msg-sent-${Date.now()}`,
      sender: 'me (user@jarvis.ai)',
      recipient: draftRecipient,
      subject: draftSubject,
      snippet: draftBody.slice(0, 80),
      body: draftBody,
      body_plain: draftBody,
      body_html: `<p>${draftBody.replace(/\n/g, '<br>')}</p>`,
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      is_unread: false,
      is_starred: false,
      labels: ['SENT'],
      attachments: [],
      status: 'sent',
    };
    setEmails([sentMsg, ...emails]);
    setConfirmStep(false);
    setEmailStatusMessage(`Email successfully dispatched to ${draftRecipient}`);
    setTimeout(() => setEmailStatusMessage(null), 4000);
  };

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col bg-[#050b14] text-slate-200 font-mono">
      {/* Sub Header */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#08101e] border-b border-cyan-900/30 text-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
              activeTab === 'calendar'
                ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>Google Calendar API</span>
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
              activeTab === 'email'
                ? 'bg-cyan-950 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gmail API (Safe Confirm)</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span>Timezone:</span>
          <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            Asia/Kolkata (+05:30)
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full">
        {activeTab === 'calendar' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>Google Calendar Integration Service</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Handles schedule retrieval, event creation, conflict warnings, and summaries in Asia/Kolkata timezone.
                </p>
              </div>
            </div>

            {calendarAlert && (
              <div className="p-3 bg-cyan-950/60 border border-cyan-500/40 rounded text-xs text-cyan-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{calendarAlert}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Event Creation Form */}
              <div className="p-5 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-4">
                <h3 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule New Event</span>
                </h3>
                <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Event Title:</label>
                    <input
                      type="text"
                      value={newSummary}
                      onChange={(e) => setNewSummary(e.target.value)}
                      placeholder="e.g. Flight to Mumbai"
                      className="w-full bg-[#030712] border border-cyan-950 rounded p-2 text-slate-200 outline-none focus:border-cyan-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Start Date &amp; Time:</label>
                    <input
                      type="datetime-local"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                      className="w-full bg-[#030712] border border-cyan-950 rounded p-2 text-slate-200 outline-none focus:border-cyan-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Location / Link:</label>
                    <input
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="Virtual / Conference Room"
                      className="w-full bg-[#030712] border border-cyan-950 rounded p-2 text-slate-200 outline-none focus:border-cyan-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded transition-colors"
                  >
                    Create Calendar Event
                  </button>
                </form>
              </div>

              {/* Events List */}
              <div className="lg:col-span-2 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Upcoming Events ({events.length})
                </div>
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-4 bg-[#08101e] border border-cyan-900/30 rounded-lg flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-cyan-200">{evt.summary}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>{evt.start}</span>
                        </span>
                        {evt.location && <span>· {evt.location}</span>}
                      </div>
                      {evt.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">{evt.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(evt.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyan-400" />
                <span>Gmail Integration &amp; Safe Confirm Flow</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Prompt 1 Requirement: Always display recipient, subject, and preview, and require explicit confirmation before sending.
              </p>
            </div>

            {emailStatusMessage && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{emailStatusMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Email Composer */}
              <div className="p-5 bg-[#08101e] border border-cyan-900/30 rounded-lg space-y-4">
                <h3 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <Send className="w-3.5 h-3.5" />
                  <span>Compose Email</span>
                </h3>

                <form onSubmit={handleSendEmailInitiate} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Recipient:</label>
                    <input
                      type="email"
                      value={draftRecipient}
                      onChange={(e) => setDraftRecipient(e.target.value)}
                      className="w-full bg-[#030712] border border-cyan-950 rounded p-2 text-slate-200 outline-none focus:border-cyan-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Subject:</label>
                    <input
                      type="text"
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      className="w-full bg-[#030712] border border-cyan-950 rounded p-2 text-slate-200 outline-none focus:border-cyan-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Message Body:</label>
                    <textarea
                      rows={4}
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      className="w-full bg-[#030712] border border-cyan-950 rounded p-2 text-slate-200 outline-none focus:border-cyan-400"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded transition-colors"
                  >
                    Review &amp; Request Send Confirmation
                  </button>
                </form>
              </div>

              {/* Confirmation Guard & Inbox */}
              <div className="space-y-4">
                {confirmStep && (
                  <div className="p-5 bg-amber-950/40 border border-amber-500/50 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Security Guard: Confirm Email Dispatch</span>
                    </div>
                    <div className="p-3 bg-black/60 rounded border border-amber-950 text-xs space-y-1.5 text-slate-300">
                      <div>
                        <span className="text-slate-500">To:</span> {draftRecipient}
                      </div>
                      <div>
                        <span className="text-slate-500">Subject:</span> {draftSubject}
                      </div>
                      <div className="text-slate-400 pt-1 text-[11px] italic">
                        "{draftBody.slice(0, 180)}..."
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setConfirmStep(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded border border-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmSend}
                        className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded"
                      >
                        Confirm &amp; Send Now
                      </button>
                    </div>
                  </div>
                )}

                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Inbox className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Messages History ({emails.length})</span>
                </div>
                <div className="space-y-2">
                  {emails.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 bg-[#08101e] border border-cyan-900/30 rounded text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-cyan-200">{m.subject}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                            m.status === 'sent'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <span>From: {m.sender}</span> · <span>{m.date}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{m.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
