"use client";

import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-emerald-500">
        <Loader2 className="h-8 w-8 animate-spin" />
        <div className="text-sm font-mono tracking-widest uppercase animate-pulse">Loading Profile Data...</div>
      </div>
    </div>
  );
}
