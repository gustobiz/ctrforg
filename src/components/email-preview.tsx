"use client";

import React, { useState, useEffect } from 'react';
import { Eye, Edit3, Settings, Sparkles, RefreshCw, PenTool, Check, X } from 'lucide-react';
import { renderSignatureHtml, UserSignature } from '@/lib/email/signature';
import { useGlobalSignature } from '@/hooks/use-global-signature';

interface EmailPreviewProps {
  subjectTemplate: string;
  bodyTemplate: string;
  leadData?: Record<string, string>;
  onSave?: (subject: string, body: string) => void;
  readOnly?: boolean;
  initialUseSignature?: boolean;
}

export default function EmailPreview({
  subjectTemplate,
  bodyTemplate,
  leadData = {},
  onSave,
  readOnly = false,
  initialUseSignature = true,
}: EmailPreviewProps) {
  const { signature, renderedHtml } = useGlobalSignature();
  const [subject, setSubject] = useState(subjectTemplate);
  const [body, setBody] = useState(bodyTemplate);
  const [detectedVars, setDetectedVars] = useState<string[]>([]);
  const [useSignature, setUseSignature] = useState<boolean>(initialUseSignature);

  const [varValues, setVarValues] = useState<Record<string, string>>({
    name: 'Jane Doe',
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    channel_name: 'Jane Tech',
    subscriber_count: '150K',
    video_title: '10 Secrets to Scale Your Next.js App',
    video_url: 'https://youtube.com/watch?v=123',
    latest_video: '10 Secrets to Scale Your Next.js App',
    niche: 'Tech & Programming',
    ...leadData
  });

  // Extract variables whenever templates change
  useEffect(() => {
    setSubject(subjectTemplate);
    setBody(bodyTemplate);

    const regex = /\{\{\s*([\w_-]+)\s*\}\}/gi;
    const found: string[] = [];
    let match;

    // Search subject
    while ((match = regex.exec(subjectTemplate)) !== null) {
      if (!found.includes(match[1].toLowerCase())) {
        found.push(match[1].toLowerCase());
      }
    }

    // Search body
    while ((match = regex.exec(bodyTemplate)) !== null) {
      if (!found.includes(match[1].toLowerCase())) {
        found.push(match[1].toLowerCase());
      }
    }

    setDetectedVars(found);
  }, [subjectTemplate, bodyTemplate]);

  // Interpolate function
  const renderInterpolated = (template: string) => {
    let result = template;
    for (const [key, value] of Object.entries(varValues)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
      result = result.replace(regex, value || `<span class="text-rose-400 font-bold bg-rose-500/10 px-1 py-0.5 rounded">{{${key}}}</span>`);
    }
    // Also mark any unresolved variables as red highlights
    const unresolvedRegex = /\{\{\s*([\w_-]+)\s*\}\}/gi;
    result = result.replace(unresolvedRegex, (m) => `<span class="text-rose-400 font-bold bg-rose-500/10 px-1 py-0.5 rounded">${m}</span>`);
    return result;
  };

  const handleVarChange = (name: string, val: string) => {
    setVarValues(prev => ({ ...prev, [name]: val }));
  };

  const interpolatedSubject = renderInterpolated(subject);
  const interpolatedBody = renderInterpolated(body);
  const renderedSigHtml = (useSignature && signature && signature.is_enabled) ? renderedHtml : '';

  return (
    <div className="grid lg:grid-cols-12 gap-6 bg-zinc-950 rounded-2xl border border-white/[0.04] p-5 shadow-2xl">
      
      {/* Variable Control Board */}
      <div className="lg:col-span-4 bg-zinc-900/40 border border-white/[0.04] p-4 rounded-xl space-y-4">
        
        {/* Signature Toggle */}
        <div className="p-3 bg-zinc-950/60 border border-white/[0.06] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <PenTool className="h-3.5 w-3.5 text-emerald-400" /> Signature Mode
            </span>
            <button
              onClick={() => setUseSignature(!useSignature)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase transition-all flex items-center gap-1 ${
                useSignature
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              {useSignature ? (
                <>
                  <Check className="h-3 w-3" /> Global Signature
                </>
              ) : (
                <>
                  <X className="h-3 w-3" /> Disabled
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight">
            {useSignature 
              ? 'Reusable signature automatically renders below template content.' 
              : 'Signature disabled for this email.'}
          </p>
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center">
            <Settings className="h-3.5 w-3.5 mr-1.5 text-zinc-500" />
            Variables Config
          </h4>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 font-extrabold px-2 py-0.5 rounded-full">
            {detectedVars.length} Detected
          </span>
        </div>

        {detectedVars.length === 0 ? (
          <p className="text-[10px] text-zinc-500 italic">
            No templates variables detected. Use syntax like {"{{name}}"} in your email.
          </p>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {detectedVars.map((v) => (
              <div key={v} className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  {v}
                </label>
                <input 
                  type="text" 
                  value={varValues[v] || ''} 
                  onChange={(e) => handleVarChange(v, e.target.value)}
                  placeholder={`Value for {{${v}}}`}
                  className="w-full bg-zinc-950 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-white/[0.04] pt-3">
          <h5 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Available System Variables</h5>
          <div className="flex flex-wrap gap-1">
            {['name', 'first_name', 'email', 'channel_name', 'subscriber_count', 'video_title', 'niche'].map((sys) => (
              <span 
                key={sys} 
                className="text-[9px] bg-zinc-900 border border-white/[0.04] text-zinc-400 font-semibold px-2 py-0.5 rounded hover:text-zinc-200 cursor-pointer"
                title={`Inserts {{${sys}}}`}
                onClick={() => {
                  if (!detectedVars.includes(sys)) {
                    setDetectedVars(prev => [...prev, sys]);
                  }
                }}
              >
                {`{{${sys}}}`}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Renderer Pane */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center">
            <Eye className="h-3.5 w-3.5 mr-1.5 text-zinc-500" />
            Live Client Preview
          </h4>
          <span className="text-[9px] text-emerald-400 font-extrabold flex items-center bg-emerald-500/5 px-2 py-0.5 rounded-full">
            <Sparkles className="h-2.5 w-2.5 mr-1" /> Dynamic Rendering Active
          </span>
        </div>

        {/* Outer Email Frame */}
        <div className="border border-white/[0.04] rounded-xl overflow-hidden bg-zinc-900/20">
          
          {/* Header block (Subject, From, To) */}
          <div className="p-4 border-b border-white/[0.04] space-y-2 bg-zinc-950/40">
            <div className="flex items-baseline text-xs">
              <span className="text-zinc-500 w-12 font-bold uppercase">To:</span>
              <span className="text-zinc-300 font-semibold">{varValues.email || 'jane@example.com'}</span>
            </div>
            <div className="flex items-baseline text-xs border-t border-white/[0.02] pt-1.5">
              <span className="text-zinc-500 w-12 font-bold uppercase">Subject:</span>
              <span 
                className="text-zinc-150 font-bold" 
                dangerouslySetInnerHTML={{ __html: interpolatedSubject || '(No Subject)' }}
              />
            </div>
          </div>

          {/* Body content block + Signature */}
          <div className="p-6 bg-[#0c0c0e] min-h-[250px] overflow-y-auto max-h-[400px]">
            <div 
              className="text-sm text-zinc-300 space-y-4 leading-relaxed font-sans prose prose-invert"
              dangerouslySetInnerHTML={{ __html: interpolatedBody || '<p class="text-zinc-500 italic">No Body Content</p>' }}
            />
            {renderedSigHtml && (
              <div 
                className="mt-6 text-zinc-200 [&_.sig-name]:text-zinc-100 [&_.sig-role]:text-zinc-400 [&_a]:text-emerald-400 [&_a:hover]:underline"
                dangerouslySetInnerHTML={{ __html: renderedSigHtml }}
              />
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
