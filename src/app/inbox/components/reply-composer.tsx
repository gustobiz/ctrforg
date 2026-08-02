"use client";

import { useState, useRef } from 'react';
import { Send, Paperclip, Bold, Italic, List, Link, Sparkles, Check, AlertCircle, FileText } from 'lucide-react';

interface ReplyComposerProps {
  toEmail: string;
  subject: string;
  threadId?: string;
  parentMessageId?: string;
  campaignId?: string;
  leadId?: string;
  onSendSuccess: () => void;
  aiSuggestedReply?: string;
}

export function ReplyComposer({
  toEmail,
  subject,
  threadId,
  parentMessageId,
  campaignId,
  leadId,
  onSendSuccess,
  aiSuggestedReply,
}: ReplyComposerProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // If AI suggestion passed in, populate composer
  if (aiSuggestedReply && content !== aiSuggestedReply && sendStatus === 'idle') {
    setContent(aiSuggestedReply);
  }

  const handleFormat = (command: string) => {
    const textarea = document.getElementById('reply-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let formatted = selectedText;
    if (command === 'bold') formatted = `**${selectedText || 'bold text'}**`;
    if (command === 'italic') formatted = `*${selectedText || 'italic text'}*`;
    if (command === 'list') formatted = `\n- ${selectedText || 'List item'}`;
    if (command === 'link') formatted = `[${selectedText || 'Link text'}](https://example.com)`;

    const newContent = content.substring(0, start) + formatted + content.substring(end);
    setContent(newContent);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  const handleSend = async () => {
    if (!content.trim() || sending) return;

    setSending(true);
    setSendStatus('sending');
    setErrorMessage('');

    try {
      // Format plain text content to simple HTML paragraphs
      const htmlBody = content
        .split('\n\n')
        .map(p => `<p style="margin-bottom:12px;line-height:1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');

      const res = await fetch('/api/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          parentMessageId,
          toEmail,
          subject,
          htmlBody,
          campaignId,
          leadId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSendStatus('sent');
        setContent('');
        setAttachments([]);
        setTimeout(() => setSendStatus('idle'), 3000);
        onSendSuccess();
      } else {
        setSendStatus('failed');
        setErrorMessage(data.error || 'Failed to send reply');
      }
    } catch (err: any) {
      setSendStatus('failed');
      setErrorMessage(err.message || 'Network error while sending reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-white/[0.06] bg-[#0c0c10] p-4 space-y-3">
      
      {/* Target Recipient Bar */}
      <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold px-1">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-extrabold">Replying To:</span>
          <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            {toEmail}
          </span>
        </div>
        <span className="text-[11px] text-zinc-500 truncate max-w-[250px]">
          Subject: <strong className="text-zinc-300">{subject.startsWith('Re:') ? subject : `Re: ${subject}`}</strong>
        </span>
      </div>

      {/* Text Area */}
      <div className="relative rounded-2xl bg-zinc-950 border border-white/[0.08] focus-within:border-emerald-500/50 transition-all overflow-hidden shadow-inner">
        
        {/* Editor Toolbar */}
        <div className="px-3 py-2 border-b border-white/[0.04] bg-zinc-900/30 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleFormat('bold')}
              title="Bold"
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleFormat('italic')}
              title="Italic"
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleFormat('list')}
              title="Bullet List"
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleFormat('link')}
              title="Insert Link"
              className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Link className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach File"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-1 text-[11px] font-semibold"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span>Attach</span>
            </button>
          </div>
        </div>

        {/* Text Input */}
        <textarea
          id="reply-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your reply message here..."
          rows={4}
          className="w-full p-3.5 text-xs text-zinc-100 bg-transparent placeholder-zinc-600 focus:outline-none resize-none leading-relaxed"
        />

        {/* Selected Attachments list */}
        {attachments.length > 0 && (
          <div className="px-3.5 py-1.5 bg-zinc-900/50 border-t border-white/[0.04] flex flex-wrap gap-2">
            {attachments.map((file, idx) => (
              <span key={idx} className="px-2 py-1 rounded bg-zinc-800 text-[10px] text-zinc-300 flex items-center gap-1">
                <FileText className="h-3 w-3 text-emerald-400" />
                {file.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Error Message banner */}
      {sendStatus === 'failed' && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Send Button & Status */}
      <div className="flex justify-between items-center pt-1">
        <div className="text-[11px] font-bold">
          {sendStatus === 'sending' && <span className="text-amber-400 animate-pulse flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Sending reply via Gmail...</span>}
          {sendStatus === 'sent' && <span className="text-emerald-400 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Sent successfully!</span>}
          {sendStatus === 'idle' && <span className="text-zinc-600 font-normal text-[10px]">Press Send to deliver to Gmail thread</span>}
        </div>

        <button
          onClick={handleSend}
          disabled={!content.trim() || sending}
          className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className={`h-3.5 w-3.5 ${sending ? 'animate-bounce' : ''}`} />
          <span>{sending ? 'Sending...' : 'Send Reply'}</span>
        </button>
      </div>

    </div>
  );
}
