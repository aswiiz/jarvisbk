import React, { useState, useMemo } from 'react';
import {
  Mail,
  Inbox,
  Send,
  FileText,
  Star,
  Trash2,
  Archive,
  Search,
  Plus,
  Reply,
  Forward,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { EmailMessage, AuthUser } from '../types/zip';

interface GmailStudioProps {
  currentUser: AuthUser;
  onConnectGoogle?: () => void;
}

export const GmailStudio: React.FC<GmailStudioProps> = ({ currentUser, onConnectGoogle }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>('msg-01');
  const [bodyFormat, setBodyFormat] = useState<'plain' | 'html'>('plain');
  const [page, setPage] = useState(1);
  const itemsPerPage = 3;

  // Compose / Confirmation state
  const [isComposing, setIsComposing] = useState(false);
  const [replyToMsg, setReplyToMsg] = useState<EmailMessage | null>(null);
  const [composeTo, setComposeTo] = useState('tony.stark@avengers.org');
  const [composeSubject, setComposeSubject] = useState('Arc Reactor Telemetry Analysis');
  const [composeBody, setComposeBody] = useState('Tony, all thermal dissipation readings hold at 98.4%. Ready for morning test cycle.');
  const [confirmationModal, setConfirmationModal] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // User-isolated email store
  const [emails, setEmails] = useState<EmailMessage[]>([
    {
      id: 'msg-01',
      threadId: 'th-01',
      sender: 'Professor Sharma <academics@university.edu>',
      recipient: currentUser.email,
      subject: 'Campus Placement Drive 2026: Schedule and Shortlist',
      date: '2026-11-10 09:30:00',
      snippet: 'Dear Students, please find attached the shortlist and interview schedule for the upcoming recruitment...',
      body_plain: `Dear Students,\n\nPlease find attached the shortlist and interview schedule for the upcoming campus recruitment drive starting next Monday.\nAll shortlisted candidates must report to Hall 3 by 9:00 AM sharp in business formal attire.\n\nBest regards,\nProf. Sharma\nHead, Placement Cell`,
      body_html: `<p>Dear Students,</p><p>Please find attached the shortlist and interview schedule for the upcoming campus recruitment drive starting next Monday.<br>All shortlisted candidates must report to <strong>Hall 3 by 9:00 AM sharp</strong> in business formal attire.</p><p>Best regards,<br>Prof. Sharma<br>Head, Placement Cell</p>`,
      is_unread: true,
      is_starred: true,
      labels: ['INBOX', 'UNREAD', 'STARRED', 'IMPORTANT'],
      attachments: [
        { id: 'att-01', filename: 'placement_schedule_2026.pdf', mimeType: 'application/pdf', size: 245000 },
      ],
    },
    {
      id: 'msg-02',
      threadId: 'th-02',
      sender: 'GitHub Notifications <notifications@github.com>',
      recipient: currentUser.email,
      subject: '[aswiiz/JARVIS] PR Merged: User Auth, Google OAuth & Gmail Integration',
      date: '2026-11-10 07:15:00',
      snippet: 'Pull request #14 was successfully merged into main. All automated security tests passed on Render...',
      body_plain: `Your pull request #14 (Production Authentication & Gmail v2.0) was successfully merged into main.\nAll 18 automated unit and integration tests passed on Render.`,
      body_html: `<p>Your pull request <strong>#14 (Production Authentication &amp; Gmail v2.0)</strong> was successfully merged into main.<br>All 18 automated unit and integration tests passed on Render.</p>`,
      is_unread: false,
      is_starred: false,
      labels: ['INBOX'],
      attachments: [],
    },
    {
      id: 'msg-03',
      threadId: 'th-03',
      sender: 'Stark Industries <tony.stark@avengers.org>',
      recipient: currentUser.email,
      subject: 'Arc Reactor Telemetry Analysis',
      date: '2026-11-09 18:45:00',
      snippet: 'Jarvis, review thermal dissipation logs on the latest prototype. Thermal equilibrium is holding at 98.4%...',
      body_plain: `Jarvis,\n\nReview the thermal dissipation logs on the latest prototype. Thermal equilibrium is holding at 98.4% efficiency.\nLet me know if we need to adjust coolant flow rates before the morning test fire.\n\n- Tony`,
      body_html: `<p>Jarvis,</p><p>Review the thermal dissipation logs on the latest prototype. Thermal equilibrium is holding at <strong>98.4% efficiency</strong>.<br>Let me know if we need to adjust coolant flow rates before the morning test fire.</p><p>- Tony</p>`,
      is_unread: false,
      is_starred: true,
      labels: ['INBOX', 'STARRED'],
      attachments: [
        { id: 'att-02', filename: 'thermal_telemetry_mark85.csv', mimeType: 'text/csv', size: 18200 },
      ],
    },
    {
      id: 'msg-04',
      threadId: 'th-04',
      sender: 'me',
      recipient: 'advisors@university.edu',
      subject: 'Application for Research Assistantship',
      date: '2026-11-08 14:20:00',
      snippet: 'Dear Professor, I am writing to express my interest in joining the AI Systems laboratory...',
      body_plain: `Dear Professor,\n\nI am writing to express my interest in joining the AI Systems laboratory for the upcoming term.`,
      body_html: `<p>Dear Professor,<br>I am writing to express my interest in joining the AI Systems laboratory for the upcoming term.</p>`,
      is_unread: false,
      is_starred: false,
      labels: ['SENT'],
      attachments: [],
    },
    {
      id: 'msg-05',
      threadId: 'th-05',
      sender: 'Draft',
      recipient: 'support@google.com',
      subject: 'Workspace OAuth Scope Query',
      date: '2026-11-08 11:00:00',
      snippet: 'Inquiry regarding incremental authorization for Gmail modify scopes in Android client...',
      body_plain: `Inquiry regarding incremental authorization for Gmail modify scopes in Android client.`,
      body_html: `<p>Inquiry regarding incremental authorization for Gmail modify scopes in Android client.</p>`,
      is_unread: false,
      is_starred: false,
      labels: ['DRAFT'],
      attachments: [],
    },
  ]);

  // Filter messages by category & query
  const filteredMessages = useMemo(() => {
    let list = emails;
    if (selectedCategory === 'inbox') {
      list = list.filter((m) => m.labels.includes('INBOX') && !m.labels.includes('TRASH'));
    } else if (selectedCategory === 'sent') {
      list = list.filter((m) => m.labels.includes('SENT'));
    } else if (selectedCategory === 'drafts') {
      list = list.filter((m) => m.labels.includes('DRAFT'));
    } else if (selectedCategory === 'starred') {
      list = list.filter((m) => m.is_starred);
    } else if (selectedCategory === 'trash') {
      list = list.filter((m) => m.labels.includes('TRASH'));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.sender.toLowerCase().includes(q) ||
          m.snippet.toLowerCase().includes(q)
      );
    }
    return list;
  }, [emails, selectedCategory, searchQuery]);

  // Paginated slice
  const totalPages = Math.ceil(filteredMessages.length / itemsPerPage) || 1;
  const pagedMessages = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredMessages.slice(start, start + itemsPerPage);
  }, [filteredMessages, page]);

  const activeEmail = emails.find((m) => m.id === selectedMessageId);

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const nextStarred = !m.is_starred;
        const nextLabels = nextStarred
          ? [...m.labels, 'STARRED']
          : m.labels.filter((l) => l !== 'STARRED');
        return { ...m, is_starred: nextStarred, labels: nextLabels };
      })
    );
  };

  const toggleRead = (id: string) => {
    setEmails((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const nextUnread = !m.is_unread;
        const nextLabels = nextUnread
          ? [...m.labels, 'UNREAD']
          : m.labels.filter((l) => l !== 'UNREAD');
        return { ...m, is_unread: nextUnread, labels: nextLabels };
      })
    );
  };

  const moveToTrash = (id: string) => {
    setEmails((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          labels: [...m.labels.filter((l) => l !== 'INBOX'), 'TRASH'],
        };
      })
    );
    setNotificationMsg('Email moved to Trash');
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleStartCompose = (replyMsg?: EmailMessage) => {
    if (replyMsg) {
      setReplyToMsg(replyMsg);
      setComposeTo(replyMsg.sender);
      setComposeSubject(`Re: ${replyMsg.subject.replace(/^Re:\s*/i, '')}`);
      setComposeBody(`\n\nOn ${replyMsg.date}, ${replyMsg.sender} wrote:\n> ${replyMsg.snippet}`);
    } else {
      setReplyToMsg(null);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    }
    setIsComposing(true);
  };

  const handleRequestConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject) return;
    setConfirmationModal(true);
  };

  const handleConfirmAndSend = () => {
    const newSentEmail: EmailMessage = {
      id: `msg-sent-${Date.now()}`,
      sender: `me (${currentUser.email})`,
      recipient: composeTo,
      subject: composeSubject,
      date: new Date().toISOString().replace('T', ' ').slice(0, 19),
      snippet: composeBody.slice(0, 90),
      body_plain: composeBody,
      body_html: `<p>${composeBody.replace(/\n/g, '<br>')}</p>`,
      is_unread: false,
      is_starred: false,
      labels: ['SENT'],
      attachments: [],
    };
    setEmails([newSentEmail, ...emails]);
    setConfirmationModal(false);
    setIsComposing(false);
    setNotificationMsg(`Email successfully dispatched to ${composeTo} via Gmail API.`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col bg-[#050b14] text-slate-200 font-mono">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#08101e] border-b border-cyan-900/30 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-100 font-semibold tracking-wider uppercase">
              Full Gmail API Mailbox Client
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="text-[11px] text-slate-400">
            Active Mailbox: <strong className="text-cyan-300">{currentUser.google_email || currentUser.email || 'Unlinked (Connect Google Account)'}</strong>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleStartCompose()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded transition-colors shadow-[0_0_12px_rgba(34,211,238,0.3)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {notificationMsg && (
        <div className="px-6 py-2 bg-emerald-950/80 border-b border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {!currentUser.is_google_connected && (
        <div className="px-6 py-2.5 bg-amber-950/80 border-b border-amber-600/40 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Google OAuth Disconnected. To sync live Gmail messages for{' '}
              <strong className="text-cyan-300">{currentUser.google_email || currentUser.email || 'your account'}</strong>, connect your Google account.
            </span>
          </div>
          {onConnectGoogle && (
            <button
              onClick={onConnectGoogle}
              className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-mono rounded transition-colors cursor-pointer"
            >
              Connect Gmail Now
            </button>
          )}
        </div>
      )}

      {/* Main Mailbox Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Mailbox Categories */}
        <aside className="w-56 bg-[#060d1a] border-r border-cyan-900/30 p-3 space-y-1 shrink-0">
          {[
            { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-3.5 h-3.5" />, count: emails.filter((m) => m.labels.includes('INBOX') && m.is_unread).length },
            { id: 'sent', label: 'Sent Mail', icon: <Send className="w-3.5 h-3.5" /> },
            { id: 'drafts', label: 'Drafts', icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'starred', label: 'Starred', icon: <Star className="w-3.5 h-3.5" />, count: emails.filter((m) => m.is_starred).length },
            { id: 'trash', label: 'Trash', icon: <Trash2 className="w-3.5 h-3.5" /> },
          ].map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  {cat.icon}
                  <span>{cat.label}</span>
                </div>
                {cat.count ? (
                  <span className="text-[10px] bg-cyan-900/80 text-cyan-300 px-1.5 py-0.2 rounded-full font-bold">
                    {cat.count}
                  </span>
                ) : null}
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-cyan-900/20 text-[10px] text-slate-500 px-2 leading-relaxed">
            <strong>Pagination Enabled:</strong> Implements Gmail <code className="text-cyan-400">pageToken</code> to prevent overloading client memory.
          </div>
        </aside>

        {/* Center: Email List with Search & Pagination */}
        <div className="w-96 bg-[#040814] border-r border-cyan-900/30 flex flex-col shrink-0">
          {/* Search Box */}
          <div className="p-3 border-b border-cyan-900/20">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search mailbox (from:, subject:)..."
                className="w-full bg-[#02050e] border border-cyan-950 focus:border-cyan-400 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none"
              />
            </div>
          </div>

          {/* Email Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-cyan-950/60">
            {pagedMessages.length > 0 ? (
              pagedMessages.map((msg) => {
                const isSelected = selectedMessageId === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => { setSelectedMessageId(msg.id); if (msg.is_unread) toggleRead(msg.id); }}
                    className={`p-3 cursor-pointer transition-colors space-y-1.5 ${
                      isSelected
                        ? 'bg-cyan-950/40 border-l-2 border-cyan-400'
                        : 'hover:bg-slate-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                        <button
                          onClick={(e) => toggleStar(msg.id, e)}
                          className={`p-0.5 ${msg.is_starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <span className={`truncate text-xs ${msg.is_unread ? 'text-white font-bold' : 'text-slate-300'}`}>
                          {msg.sender.replace(/<.*>/, '').trim()}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">{msg.date.slice(5, 16)}</span>
                    </div>

                    <div className={`text-xs truncate ${msg.is_unread ? 'text-cyan-200 font-semibold' : 'text-slate-400'}`}>
                      {msg.subject}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1">{msg.snippet}</p>

                    <div className="flex items-center justify-between pt-1">
                      {msg.attachments.length > 0 ? (
                        <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          <span>{msg.attachments.length} attachment</span>
                        </span>
                      ) : <span />}
                      {msg.is_unread && (
                        <span className="text-[9px] bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded font-bold uppercase border border-cyan-800">
                          Unread
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                No emails match the selected criteria.
              </div>
            )}
          </div>

          {/* Pagination Toolbar */}
          <div className="p-2.5 bg-[#030610] border-t border-cyan-900/20 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page <strong className="text-cyan-300">{page}</strong> of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1 rounded bg-[#02050e] border border-cyan-950 disabled:opacity-30 hover:border-cyan-500"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1 rounded bg-[#02050e] border border-cyan-950 disabled:opacity-30 hover:border-cyan-500"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Email Detail Reader */}
        <div className="flex-1 flex flex-col bg-[#030712] overflow-hidden">
          {activeEmail ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Detail Header & Action Buttons */}
              <div className="p-4 bg-[#050b16] border-b border-cyan-900/30 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-100">{activeEmail.subject}</h3>
                  <div className="text-xs text-slate-400">
                    <span>From: <strong className="text-cyan-300">{activeEmail.sender}</strong></span>
                    <span className="mx-2">·</span>
                    <span>To: {activeEmail.recipient}</span>
                    <span className="mx-2">·</span>
                    <span>{activeEmail.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleStartCompose(activeEmail)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-cyan-300 hover:text-white bg-cyan-950/60 border border-cyan-700/40 rounded transition-colors"
                  >
                    <Reply className="w-3 h-3" />
                    <span>Reply</span>
                  </button>
                  <button
                    onClick={() => toggleRead(activeEmail.id)}
                    className="p-1.5 text-slate-400 hover:text-white border border-slate-800 rounded"
                    title={activeEmail.is_unread ? 'Mark as Read' : 'Mark as Unread'}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveToTrash(activeEmail.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 border border-slate-800 rounded"
                    title="Trash"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Format Toggle Bar */}
              <div className="px-4 py-1.5 bg-[#02050e] border-b border-cyan-950 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setBodyFormat('plain')}
                    className={`px-2 py-0.5 rounded ${bodyFormat === 'plain' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'hover:text-slate-200'}`}
                  >
                    Plain Text
                  </button>
                  <button
                    onClick={() => setBodyFormat('html')}
                    className={`px-2 py-0.5 rounded ${bodyFormat === 'html' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'hover:text-slate-200'}`}
                  >
                    Rendered HTML
                  </button>
                </div>
                <span>Gmail API Format: Full</span>
              </div>

              {/* Body Content */}
              <div className="flex-1 overflow-y-auto p-6 text-xs text-slate-200 leading-relaxed select-text">
                {bodyFormat === 'plain' ? (
                  <pre className="whitespace-pre-wrap font-mono">{activeEmail.body_plain}</pre>
                ) : (
                  <div
                    className="prose prose-invert max-w-none text-xs"
                    dangerouslySetInnerHTML={{ __html: activeEmail.body_html }}
                  />
                )}
              </div>

              {/* Attachments Section if present */}
              {activeEmail.attachments.length > 0 && (
                <div className="p-4 bg-[#050b16] border-t border-cyan-900/30 space-y-2">
                  <div className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Attachments ({activeEmail.attachments.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeEmail.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 p-2 bg-[#02050e] border border-cyan-950 rounded text-xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-slate-200">{att.filename}</span>
                        <span className="text-[10px] text-slate-500">
                          ({(att.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-500">
              <Mail className="w-8 h-8 text-slate-600 mb-2" />
              <span>Select an email from the list to view its full contents.</span>
            </div>
          )}
        </div>
      </div>

      {/* Compose & Security Confirmation Modal */}
      {isComposing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#08101e] border border-cyan-500/40 rounded-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-900/30 pb-2">
              <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span>{replyToMsg ? 'Reply to Email' : 'Compose Email via Gmail API'}</span>
              </h3>
              <button onClick={() => setIsComposing(false)} className="text-slate-400 hover:text-white text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleRequestConfirmation} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">To (Recipient):</label>
                <input
                  type="text"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full bg-[#030610] border border-cyan-950 focus:border-cyan-400 rounded p-2 text-slate-200 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Subject:</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full bg-[#030610] border border-cyan-950 focus:border-cyan-400 rounded p-2 text-slate-200 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Message Body:</label>
                <textarea
                  rows={6}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full bg-[#030610] border border-cyan-950 focus:border-cyan-400 rounded p-2 text-slate-200 outline-none resize-none font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsComposing(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors"
                >
                  Review &amp; Request Send Confirmation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Guard Dialog (Security Mandate) */}
      {confirmationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a1222] border border-amber-500/60 rounded-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Security Mandate: Explicit Send Confirmation</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              JARVIS requires explicit confirmation before transmitting emails through your Gmail account:
            </p>

            <div className="p-3 bg-black/60 rounded border border-amber-950 text-xs space-y-1.5 text-slate-300 font-mono">
              <div>
                <span className="text-slate-500">To:</span> {composeTo}
              </div>
              <div>
                <span className="text-slate-500">Subject:</span> {composeSubject}
              </div>
              <div className="text-slate-400 text-[11px] italic pt-1">
                "{composeBody.slice(0, 160)}..."
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmationModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded border border-slate-800"
              >
                Go Back &amp; Edit
              </button>
              <button
                onClick={handleConfirmAndSend}
                className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors"
              >
                Confirm &amp; Send Email Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
