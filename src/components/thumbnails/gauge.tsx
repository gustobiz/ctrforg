"use client";

import React, { useEffect, useState } from "react";

interface GaugeProps {
  value: number; // 0 to 100
  title: string;
  subtitle?: string;
  size?: number;
  strokeWidth?: number;
  glowColor?: string;
}

export default function Gauge({
  value,
  title,
  subtitle = "Score",
  size = 110,
  strokeWidth = 8,
}: GaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 150);
    return () => clearTimeout(timer);
  }, [value]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Create a 270-degree (3/4) gauge circle for a professional speedometer feel
  const angleRange = 270; 
  const strokeDashoffset = circumference - (animatedValue / 100) * (circumference * (angleRange / 360));
  const strokeDasharray = `${circumference * (angleRange / 360)} ${circumference}`;

  // Dynamic colors based on standard metric cutoffs
  const getColor = (val: number) => {
    if (val >= 75) return "#10b981"; // neon green
    if (val >= 50) return "#f59e0b"; // amber yellow
    return "#f43f5e"; // rose red
  };

  const activeColor = getColor(animatedValue);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-zinc-900/30 backdrop-blur-xl border border-white/[0.04] rounded-2xl shadow-xl hover:border-white/[0.08] transition-all duration-300 group select-none w-full">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Ambient background blur gradient */}
        <div 
          className="absolute inset-0 rounded-full blur-[18px] opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-300 pointer-events-none"
          style={{ backgroundColor: activeColor }}
        />

        <svg 
          width={size} 
          height={size} 
          className="transform -rotate-225 pointer-events-none"
        >
          {/* Background tracking track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference * (angleRange / 360)} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Active progress ring with ambient glowing filter */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={0}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 3px ${activeColor}60)`
            }}
          />
        </svg>

        {/* Numeric layout overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-2xl font-black tracking-tighter text-foreground transition-transform duration-300 group-hover:scale-105">
            {Math.round(animatedValue)}
            <span className="text-[11px] font-bold text-muted-foreground opacity-60">%</span>
          </span>
          {subtitle && (
            <span className="text-[8px] font-extrabold uppercase tracking-wider text-muted-foreground mt-0.5 opacity-55">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <span className="text-xs font-semibold text-zinc-400 mt-3 tracking-wide">
        {title}
      </span>
    </div>
  );
}
