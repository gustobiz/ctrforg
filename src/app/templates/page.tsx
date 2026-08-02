"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, FileText, Trash2, Copy, Share2, Edit2, 
  Folder, ArrowLeft, Save, Sparkles, Check, X, Target, User, LogOut, CreditCard, Settings, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import EmailPreview from '@/components/email-preview';
import DeliverabilityPanel from '@/components/deliverability-panel';

interface Template {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
  category: string;
  is_shared: boolean;
  user_id: string;
  created_at: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All Templates' },
  { id: 'outreach', label: 'Thumbnail Outreach' },
  { id: 'agency', label: 'YouTube Agency' },
  { id: 'coaching', label: 'Coaching' },
  { id: 'saas', label: 'SaaS' },
  { id: 'freelance', label: 'Freelance' },
  { id: 'custom', label: 'Custom' }
];

export default function TemplatesLibrary() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Editor states
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCategory, setEditCategory] = useState('custom');
  const [editIsShared, setEditIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  // Variables manager states
  const [isVarsManagerOpen, setIsVarsManagerOpen] = useState(false);
  const [customVars, setCustomVars] = useState<any[]>([]);
  const [newVarName, setNewVarName] = useState('');
  const [newVarDefault, setNewVarDefault] = useState('');
  const [loadingVars, setLoadingVars] = useState(false);

  // Variable insertion ref
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchCustomVars = async () => {
    try {
      setLoadingVars(true);
      const res = await fetch('/api/variables');
      const data = await res.json();
      if (data.success) {
        setCustomVars(data.customVariables || []);
      }
    } catch (err) {
      console.error('Failed to load variables:', err);
    } finally {
      setLoadingVars(false);
    }
  };

  const handleAddVariable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarName) return;
    try {
      const res = await fetch('/api/variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVarName, defaultValue: newVarDefault }),
      });
      const data = await res.json();
      if (data.success) {
        setNewVarName('');
        setNewVarDefault('');
        fetchCustomVars();
      } else {
        alert(data.error || 'Failed to add variable');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteVariable = async (id: string) => {
    try {
      const res = await fetch(`/api/variables?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchCustomVars();
      } else {
        alert(data.error || 'Failed to delete variable');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/email/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email ?? null);
        setCurrentUserId(data.user.id);
      }
    });

    fetchTemplates();
    fetchCustomVars();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setEditName('Untitled Template');
    setEditSubject('Hello {{name}}');
    setEditBody('<p>Hey {{name}},</p><p>I was watching your video {{video_title}} and noticed...</p>');
    setEditCategory('custom');
    setEditIsShared(false);
    setEditorOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditSubject(template.subject);
    setEditBody(template.html_body);
    setEditCategory(template.category || 'custom');
    setEditIsShared(template.is_shared || false);
    setEditorOpen(true);
  };

  const handleDuplicate = async (templateId: string) => {
    try {
      const res = await fetch('/api/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duplicateFromId: templateId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to duplicate:', err);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Delete this template permanently?')) return;
    try {
      const res = await fetch(`/api/email/templates?id=${templateId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const handleSave = async () => {
    if (!editName || !editSubject) {
      alert('Template Name and Subject are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: editingTemplate?.id,
        name: editName,
        subject: editSubject,
        htmlBody: editBody,
        textBody: '', // Handled server-side or generated
        category: editCategory,
        isShared: editIsShared,
      };

      const method = editingTemplate ? 'PUT' : 'POST';
      const res = await fetch('/api/email/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        fetchTemplates();
        setEditorOpen(false);
      } else {
        alert(data.error || 'Failed to save template');
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const placeholder = `{{${variable}}}`;
    
    const nextBody = editBody.substring(0, start) + placeholder + editBody.substring(end);
    setEditBody(nextBody);
    
    // Reset focus and cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 50);
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Header Bar */}
      <header className="px-8 h-16 flex items-center justify-between border-b border-white/[0.04] sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center text-zinc-100 hover:text-emerald-400 transition-colors mr-6">
            <Target className="h-5 w-5 text-emerald-400 mr-2" />
            <span className="font-extrabold tracking-tight text-sm uppercase">CTRForge OS</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Link href="/dashboard" className="hover:text-zinc-200 transition-colors">Overview</Link>
            <Link href="/discovery" className="hover:text-zinc-200 transition-colors">Research Workspace</Link>
            <Link href="/thumbnails" className="hover:text-zinc-200 transition-colors">Thumbnail Studio</Link>
            <Link href="/crm" className="hover:text-zinc-200 transition-colors">CRM Pipelines</Link>
            <Link href="/campaigns" className="hover:text-zinc-200 transition-colors">Campaigns</Link>
            <Link href="/templates" className="text-zinc-100 font-bold border-b border-white pb-1.5 pt-1">Templates</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/settings" className="hidden md:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-zinc-900 border border-white/[0.04] text-zinc-300 hover:bg-zinc-800 transition-colors">
            <Settings className="h-3.5 w-3.5 text-zinc-500" />
            Settings
          </Link>
          
          <div className="relative" ref={dropdownRef}>
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="h-8 w-8 rounded-full bg-zinc-900 border border-white/[0.06] flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors font-black text-xs text-zinc-300"
            >
              <span>{userEmail ? userEmail.charAt(0).toUpperCase() : 'G'}</span>
            </div>
            
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2.5 w-56 rounded-xl border border-white/[0.06] bg-zinc-950 p-1.5 shadow-2xl z-50">
                <div className="px-3 py-2 text-xs font-bold text-zinc-400 truncate border-b border-white/[0.04] pb-2 mb-1.5">
                  {userEmail || 'Guest Account'}
                </div>
                <div className="space-y-0.5">
                  <Link href="/profile" className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors">
                    <User className="mr-2 h-4 w-4 text-zinc-500" /> My Profile
                  </Link>
                  <Link href="/billing" className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors">
                    <CreditCard className="mr-2 h-4 w-4 text-zinc-500" /> Billing Details
                  </Link>
                  <Link href="/settings" className="flex items-center rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors">
                    <Settings className="mr-2 h-4 w-4 text-zinc-500" /> Settings
                  </Link>
                  <div className="h-px bg-white/[0.04] my-1"></div>
                  <button onClick={handleLogout} className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/5 transition-colors">
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 container max-w-[1350px] py-12 mx-auto px-6 md:px-8">
        
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">Template Library</h1>
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Save, duplicate, and share high-converting outreach layouts.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsVarsManagerOpen(true)}
              className="h-9 px-4 rounded-lg bg-zinc-900 border border-white/[0.06] hover:bg-zinc-800 text-zinc-300 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center"
            >
              <Settings className="h-4 w-4 mr-1.5" />
              Manage Variables
            </button>
            <button 
              onClick={handleCreateNew} 
              className="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center shadow-md shadow-emerald-500/10"
            >
              <Plus className="h-4 w-4 mr-1.5 stroke-[3px]" />
              Create Template
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col lg:flex-row gap-5 items-stretch lg:items-center justify-between mb-8">
          {/* Categories Tab list */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-zinc-900/30 border border-white/[0.04]">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${selectedCategory === cat.id ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/20 border border-white/[0.04] rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Grid List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <RefreshCw className="h-8 w-8 animate-spin mb-4" />
            <p className="text-sm font-semibold uppercase tracking-wider">Loading template library...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/[0.04] rounded-3xl bg-zinc-950/20">
            <FileText className="h-10 w-10 text-zinc-600 mb-4" />
            <h4 className="text-zinc-300 font-bold text-sm mb-1 uppercase tracking-wider">No Templates Found</h4>
            <p className="text-zinc-500 text-xs mb-6">Create a template or change filters to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((t) => (
              <div 
                key={t.id} 
                className="group border border-white/[0.04] bg-zinc-900/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/[0.08] shadow-xl hover:shadow-2xl transition-all relative overflow-hidden"
              >
                {/* Content */}
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[9px] bg-zinc-900 border border-white/[0.04] text-zinc-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {t.category || 'custom'}
                    </span>
                    {t.is_shared && (
                      <span className="text-[9px] text-emerald-400 font-extrabold flex items-center bg-emerald-500/5 px-2 py-0.5 rounded-full uppercase">
                        <Share2 className="h-2.5 w-2.5 mr-1" /> Public
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors mb-1 line-clamp-1">{t.name}</h3>
                  <p className="text-xs text-zinc-400 font-medium mb-4 line-clamp-1">Subject: {t.subject}</p>
                  
                  {/* Body Preview */}
                  <div 
                    className="text-[11px] text-zinc-500 line-clamp-3 bg-zinc-950/40 p-3 rounded-lg border border-white/[0.02] mb-6 min-h-[50px] font-sans prose prose-invert select-none"
                    dangerouslySetInnerHTML={{ __html: t.html_body || '(Empty)' }}
                  />
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center border-t border-white/[0.04] pt-4 mt-auto">
                  <span className="text-[10px] text-zinc-600 font-semibold">
                    {new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>

                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleDuplicate(t.id)}
                      className="p-1.5 rounded-lg bg-zinc-950 border border-white/[0.04] text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {t.user_id === currentUserId && (
                      <>
                        <button 
                          onClick={() => handleEdit(t)}
                          className="p-1.5 rounded-lg bg-zinc-950 border border-white/[0.04] text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 rounded-lg bg-zinc-950 border border-white/[0.04] text-rose-500 hover:text-rose-450 hover:bg-zinc-900 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit/Create Modal (Slideover/Full Screen Overlay) */}
        {editorOpen && (
          <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 md:p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-6xl h-[90vh] bg-zinc-950 border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
              
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between bg-zinc-950/90">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setEditorOpen(false)}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-white/[0.04] text-zinc-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-200">
                    {editingTemplate ? 'Modify Outreach Template' : 'Design Outreach Template'}
                  </h3>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setEditorOpen(false)}
                    className="h-8 px-4 rounded-lg bg-zinc-900 border border-white/[0.04] text-zinc-400 hover:text-white text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="h-8 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 disabled:text-zinc-650 text-zinc-950 text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                  >
                    {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Template
                  </button>
                </div>
              </div>

              {/* Modal Body (Split Panel Edit & Preview) */}
              <div className="flex-1 overflow-y-auto p-6 grid lg:grid-cols-12 gap-8 bg-[#09090b]/50">
                
                {/* Editor Inputs (Left) */}
                <div className="lg:col-span-5 space-y-5 flex flex-col h-full pr-1">
                  
                  {/* Name field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                      Template Name
                    </label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. YT Outreach Sequence Part 1"
                      className="w-full bg-zinc-900/40 border border-white/[0.04] rounded-xl px-4 py-2.5 text-xs text-zinc-250 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  {/* Category & Shared Select */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                        Category
                      </label>
                      <select 
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full bg-zinc-900/40 border border-white/[0.04] rounded-xl px-3 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors"
                      >
                        {CATEGORIES.slice(1).map(c => (
                          <option key={c.id} value={c.id} className="bg-zinc-950">{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                        Privacy / Share Status
                      </label>
                      <div className="flex items-center h-10">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={editIsShared}
                            onChange={(e) => setEditIsShared(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-zinc-950"></div>
                          <span className="ml-2 text-xs font-bold text-zinc-400 peer-checked:text-emerald-400 uppercase tracking-wider">
                            {editIsShared ? 'Public Share' : 'Private'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Subject line field */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                      Email Subject
                    </label>
                    <input 
                      type="text" 
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Hey {{name}}, loved your video on {{niche}}!"
                      className="w-full bg-zinc-900/40 border border-white/[0.04] rounded-xl px-4 py-2.5 text-xs text-zinc-200 font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  {/* Variable Injection Bar */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
                      Click to insert template variable:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {/* System Variables */}
                      {['name', 'first_name', 'email', 'channel_name', 'subscriber_count', 'video_title', 'video_url', 'niche'].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVariable(v)}
                          className="text-[9px] bg-zinc-900/80 border border-white/[0.04] text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold px-2 py-1 rounded transition-colors"
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                      {/* Custom Variables */}
                      {customVars.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => insertVariable(v.name)}
                          className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 font-bold px-2 py-1 rounded transition-all"
                          title={v.default_value ? `Default: ${v.default_value}` : 'No default value'}
                        >
                          {`{{${v.name}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Deliverability check panel */}
                  <div className="pt-2">
                    <DeliverabilityPanel subject={editSubject} htmlBody={editBody} />
                  </div>

                  {/* Body Textarea field */}
                  <div className="space-y-1 flex-1 flex flex-col min-h-[220px]">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                      Email Body (HTML / Rich Text format)
                    </label>
                    <textarea 
                      ref={bodyTextareaRef}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      placeholder="Write your email body in HTML format here..."
                      className="w-full flex-1 bg-zinc-900/40 border border-white/[0.04] rounded-xl p-4 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500 resize-none transition-colors"
                    />
                  </div>

                </div>

                {/* Real-time preview panel (Right) */}
                <div className="lg:col-span-7 flex flex-col">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">
                    Live Preview Simulation
                  </span>
                  <div className="flex-1 overflow-y-auto">
                    <EmailPreview 
                      subjectTemplate={editSubject}
                      bodyTemplate={editBody}
                      readOnly={true}
                    />
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}
      </main>

      {/* Variables Manager Modal */}
      {isVarsManagerOpen && (
        <div className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-zinc-950 border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-200 flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-400" /> Manage Custom Variables
              </h3>
              <button 
                onClick={() => setIsVarsManagerOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddVariable} className="space-y-4 bg-zinc-900/20 p-4 rounded-xl border border-white/[0.02]">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Create Custom Variable</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Variable Name</label>
                  <input 
                    type="text" 
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    placeholder="e.g. custom_offer"
                    className="w-full bg-zinc-950 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Default Value</label>
                  <input 
                    type="text" 
                    value={newVarDefault}
                    onChange={(e) => setNewVarDefault(e.target.value)}
                    placeholder="e.g. 10% off"
                    className="w-full bg-zinc-950 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full h-8 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-extrabold uppercase rounded-lg transition-colors"
              >
                Create Variable
              </button>
            </form>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                <span>Active Custom Variables</span>
                <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">{customVars.length} total</span>
              </h4>

              {loadingVars ? (
                <div className="text-center py-6 text-zinc-500">
                  <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1.5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider">Syncing variables database...</span>
                </div>
              ) : customVars.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-4">No custom variables created yet. Use the form above to add one.</p>
              ) : (
                <div className="divide-y divide-white/[0.02] max-h-[220px] overflow-y-auto pr-1">
                  {customVars.map((v) => (
                    <div key={v.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex flex-col">
                        <span className="font-mono text-emerald-400 font-bold">{`{{${v.name}}}`}</span>
                        <span className="text-[10px] text-zinc-500 mt-0.5">Default: {v.default_value || <span className="italic text-zinc-650">none</span>}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteVariable(v.id)}
                        className="p-1.5 bg-zinc-900 border border-white/[0.04] text-rose-500 hover:bg-zinc-800 hover:text-rose-450 rounded-lg transition-colors"
                        title="Delete variable"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
