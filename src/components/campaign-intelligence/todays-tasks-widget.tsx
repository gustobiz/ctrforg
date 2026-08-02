"use client";

import React from 'react';
import { CheckSquare, ArrowUpRight, Clock, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TaskItem } from '@/hooks/use-campaign-intelligence';

interface Props {
  tasks?: TaskItem[];
}

export default function TodaysTasksWidget({ tasks }: Props) {
  const router = useRouter();

  const defaultTasks: TaskItem[] = [
    {
      id: 'task-1',
      title: 'Reply to interested leads in Unified Inbox',
      category: 'Inbox Action',
      targetUrl: '/inbox?category=interested',
      priority: 'high',
    },
    {
      id: 'task-2',
      title: 'Review today\'s scheduled follow-ups',
      category: 'Outreach Follow-up',
      targetUrl: '/crm',
      priority: 'medium',
    },
    {
      id: 'task-3',
      title: 'Verify Google Warmup Shield daily limit settings',
      category: 'Deliverability',
      targetUrl: '/campaigns',
      priority: 'low',
    },
  ];

  const taskList = tasks && tasks.length > 0 ? tasks : defaultTasks;

  const getPriorityBadge = (p: TaskItem['priority']) => {
    switch (p) {
      case 'high': return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
      case 'medium': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'low': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    }
  };

  return (
    <div className="p-5 rounded-3xl border border-white/[0.04] bg-zinc-900/10 shadow-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-200 flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-emerald-400" />
          Today's Tasks
        </h4>
        <span className="text-[10px] font-bold bg-zinc-900 border border-white/[0.06] text-zinc-400 px-2 py-0.5 rounded-full">
          {taskList.length} Action Items
        </span>
      </div>

      <div className="space-y-2.5">
        {taskList.map((task) => (
          <div
            key={task.id}
            onClick={() => router.push(task.targetUrl)}
            className="p-3 rounded-2xl border border-white/[0.04] bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-white/[0.08] transition-all cursor-pointer group flex items-center justify-between gap-3"
          >
            <div className="space-y-1 min-w-0">
              <span className={`inline-block text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getPriorityBadge(task.priority)}`}>
                {task.category}
              </span>
              <p className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors truncate">
                {task.title}
              </p>
            </div>

            <div className="h-7 w-7 rounded-xl bg-zinc-900 border border-white/[0.06] flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-all shrink-0">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
