"use client";

import React, { useState, useRef, useEffect } from "react";

interface CompareSliderProps {
  leftImage: string;
  rightImage: string;
  leftLabel?: string;
  rightLabel?: string;
}

export default function CompareSlider({
  leftImage,
  rightImage,
  leftLabel = "Concept Wireframe",
  rightLabel = "Refined AI Render",
}: CompareSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage (0 - 100)
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(position);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.current) return;
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
  };

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/[0.06] bg-zinc-950 select-none shadow-2xl"
    >
      {/* Right Image (Background - AI CTR Render) */}
      <img
        src={rightImage}
        alt="Optimized Render"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable={false}
      />
      <div className="absolute top-3 right-3 z-20 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-emerald-500 text-black rounded-md shadow-lg border border-emerald-400/20">
        {rightLabel}
      </div>

      {/* Left Image (Foreground/Clipped - Original/Concept) */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden z-10 pointer-events-none"
        style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
      >
        <img
          src={leftImage}
          alt="Concept Original"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ width: containerRef.current ? containerRef.current.getBoundingClientRect().width : "100%" }}
          draggable={false}
        />
        <div className="absolute top-3 left-3 z-20 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-zinc-900/90 text-zinc-300 rounded-md shadow-lg border border-white/[0.06] backdrop-blur-sm">
          {leftLabel}
        </div>
      </div>

      {/* Slider Bar & Handle */}
      <div
        className="absolute inset-y-0 z-30 w-0.5 bg-emerald-500 cursor-ew-resize group"
        style={{ left: `${sliderPosition}%` }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-zinc-900 border-2 border-emerald-500 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-200 cursor-ew-resize">
          <div className="flex gap-0.5">
            <span className="w-0.5 h-3 bg-emerald-500/80 rounded-full"></span>
            <span className="w-0.5 h-3 bg-emerald-500/80 rounded-full"></span>
          </div>
        </div>
      </div>
    </div>
  );
}
