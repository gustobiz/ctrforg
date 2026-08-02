"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  Users, UserPlus, Shield, ShieldCheck, UserMinus, PlusCircle, 
  ArrowLeft, RefreshCw, Layers, FileText, Target, CheckCircle2,
  Settings, User, LogOut, CreditCard
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  email?: string; // Hydrated or mapped
}

interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export default function TeamManagement() {
  const router = useRouter();
  const supabase = createClient();
  
  // Hydration / session states
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Team states
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [loading, setLoading] = useState(true);

  // Action states
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (data.success) {
        setTeam(data.team);
        setUserRole(data.role);
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email ?? null);
      }
    });

    fetchTeamData();

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

  const handleCreateTeam = async () => {
    if (!newTeamName) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', teamName: newTeamName }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Team created successfully!');
        fetchTeamData();
      } else {
        alert(data.error || 'Failed to create team');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'invite', 
          memberEmail: inviteEmail, 
          role: inviteRole 
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Member added successfully!');
        setInviteEmail('');
        fetchTeamData();
      } else {
        alert(data.error || 'Invitation failed');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`/api/teams?memberId=${memberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        alert('Member removed successfully.');
        fetchTeamData();
      } else {
        alert(data.error || 'Failed to remove member');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] text-[#f4f4f5] antialiased">
      
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
            <Link href="/team" className="text-zinc-100 font-bold border-b border-white pb-1.5 pt-1">Team Settings</Link>
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

      {/* Main Content */}
      <main className="flex-1 container max-w-[1000px] py-12 mx-auto px-6 md:px-8">
        
        {/* Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent">Team Collaboration</h1>
            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Configure members, permissions, and shared templates or campaigns.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <RefreshCw className="h-8 w-8 animate-spin mb-4" />
            <p className="text-sm font-semibold uppercase tracking-wider">Syncing team directory...</p>
          </div>
        ) : !team ? (
          /* Create Team View */
          <div className="border border-white/[0.04] bg-zinc-900/10 rounded-3xl p-8 shadow-2xl max-w-lg mx-auto space-y-6">
            <div className="text-center space-y-2">
              <Users className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
              <h2 className="text-lg font-bold text-zinc-200 uppercase tracking-wider">Establish a Outreach Team</h2>
              <p className="text-xs text-zinc-500 leading-relaxed">Create a shared workspace to collaborate on creator lists, outreach templates, and active email campaigns.</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-zinc-500 block">Workspace / Team Name</label>
              <input 
                type="text" 
                placeholder="e.g. Acme Video Growth Agency"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              onClick={handleCreateTeam}
              disabled={submitting || !newTeamName}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-zinc-950 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md"
            >
              {submitting ? 'Creating Team...' : 'Create Outreach Workspace'}
            </button>
          </div>
        ) : (
          /* Team Directory and Invites view */
          <div className="grid md:grid-cols-12 gap-8 items-start">
            
            {/* Members Directory (7 cols) */}
            <div className="md:col-span-8 border border-white/[0.04] bg-zinc-900/10 rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/[0.04] pb-4">
                <h3 className="font-extrabold text-sm text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  {team.name} Roster
                </h3>
                <span className="text-[9px] bg-zinc-950 border border-white/[0.04] px-2 py-0.5 rounded-full text-zinc-500 font-bold uppercase">
                  {members.length} Members
                </span>
              </div>

              {/* Members List */}
              <div className="divide-y divide-white/[0.02] bg-zinc-950/20 rounded-2xl border border-white/[0.01]">
                {members.map((m) => (
                  <div key={m.id} className="p-4 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-zinc-900 border border-white/[0.04] flex items-center justify-center font-bold text-zinc-300 text-xs">
                        {m.role.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-200">ID: {m.user_id.substring(0, 8)}...</span>
                        <span className="text-[10px] text-zinc-500 font-medium">Joined: {new Date(m.joined_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black uppercase bg-zinc-900 border border-white/[0.04] px-2 py-0.5 rounded text-zinc-400">
                        {m.role}
                      </span>

                      {/* Remove button if current user is owner/admin */}
                      {(userRole === 'owner' || userRole === 'admin') && m.role !== 'owner' && m.user_id !== team.owner_id && (
                        <button 
                          onClick={() => handleRemove(m.id)}
                          className="p-1 rounded bg-zinc-900 border border-white/[0.04] text-rose-500 hover:bg-zinc-800 transition-colors"
                          title="Remove from Team"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite Form / Permissions Card (4 cols) */}
            <div className="md:col-span-4 space-y-6">
              
              {/* Invite panel */}
              {(userRole === 'owner' || userRole === 'admin') && (
                <div className="border border-white/[0.04] bg-zinc-900/10 rounded-3xl p-6 shadow-2xl space-y-4">
                  <h3 className="font-extrabold text-sm text-zinc-200 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/[0.04] pb-3">
                    <UserPlus className="h-4.5 w-4.5 text-zinc-500" /> Invite Collaborator
                  </h3>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-zinc-500 block">User Email</label>
                    <input 
                      type="email" 
                      placeholder="teammate@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-zinc-500 block">Assigned Role</label>
                    <select 
                      value={inviteRole}
                      onChange={(e: any) => setInviteRole(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/[0.06] rounded-xl px-2 py-2 text-xs text-zinc-300 focus:outline-none"
                    >
                      <option value="member">Workspace Member</option>
                      <option value="admin">Workspace Admin</option>
                    </select>
                  </div>

                  <button
                    onClick={handleInvite}
                    disabled={submitting || !inviteEmail}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 text-zinc-950 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1.5"
                  >
                    {submitting ? 'Adding...' : 'Add Teammate'}
                  </button>
                </div>
              )}

              {/* Shared settings card info */}
              <div className="border border-white/[0.04] bg-zinc-900/10 rounded-3xl p-6 shadow-2xl space-y-4 text-xs leading-relaxed text-zinc-400">
                <h3 className="font-extrabold text-sm text-zinc-200 uppercase tracking-wider border-b border-white/[0.04] pb-3">Workspace Sharing Rules</h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <p><strong>Shared Lead Database:</strong> All creator lists imported are visible and manageable by the team.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <p><strong>Shared Templates:</strong> Marked templates as <em>public share</em> are accessible for campaign setups.</p>
                  </div>
                  <div className="flex gap-2">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0 mt-0.5" />
                    <p><strong>Shared Campaigns:</strong> Run, pause, and monitor bulk outreach efforts as a team in real-time.</p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
