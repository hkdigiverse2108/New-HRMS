"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Star, Zap } from "lucide-react";

import { CELEBRATION_PRESETS } from "../dashboard/sections/spotlight-constants";
import { cn } from "@/lib/utils";

interface CelebrationParticle {
  id: number;
  origin?: "left" | "right" | "center" | "random";
  left?: number;
  top?: number;
  targetX?: number; 
  targetY?: number; 
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotation: number;
  iconType: "star" | "sparkle" | "circle" | "diamond" | "ribbon";
}

const COLORS = [
  "#F59E0B", // Amber Gold
  "#EF4444", // Crimson Red
  "#10B981", // Emerald Green
  "#3B82F6", // Royal Sapphire Blue
  "#8B5CF6", // Violet Purple
  "#EC4899", // Neon Pink
  "#FBBF24", // Bright Yellow
  "#06B6D4"  // Cyan Neon
];

export function SparklesCelebration({ 
  trigger, 
  effectStyle = "poppers",
  title = "Congratulations!",
  onComplete
}: { 
  trigger: boolean; 
  effectStyle?: string;
  title?: string;
  onComplete?: () => void;
}) {
  const [particles, setParticles] = useState<CelebrationParticle[]>([]);
  const [visible, setVisible] = useState(false);

  const activeEffect = CELEBRATION_PRESETS[effectStyle] ? effectStyle : "poppers";

  useEffect(() => {
    if (trigger && activeEffect !== "none") {
      setVisible(true);
      const newParticles: CelebrationParticle[] = [];

      if (activeEffect === "fireworks") {
        const count = 90;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.2);
          const distance = 250 + Math.random() * 450;
          newParticles.push({
            id: i,
            origin: "center",
            targetX: Math.cos(angle) * distance,
            targetY: Math.sin(angle) * distance,
            size: Math.floor(Math.random() * 12) + 8,
            color: COLORS[Math.floor(Math.random() * COLORS.length)] || "#FBBF24",
            delay: Math.random() * 0.35,
            duration: 2.2 + Math.random() * 1.2,
            rotation: Math.floor(Math.random() * 360),
            iconType: i % 4 === 0 ? "star" : i % 3 === 0 ? "sparkle" : i % 2 === 0 ? "diamond" : "circle"
          });
        }
      } else if (activeEffect === "rain") {
        const count = 85;
        for (let i = 0; i < count; i++) {
          newParticles.push({
            id: i,
            origin: "random",
            left: Math.random() * 96 + 2,
            size: Math.floor(Math.random() * 12) + 8,
            color: COLORS[Math.floor(Math.random() * COLORS.length)] || "#FBBF24",
            delay: Math.random() * 0.8,
            duration: 2.6 + Math.random() * 1.4,
            rotation: Math.floor(Math.random() * 360),
            iconType: i % 4 === 0 ? "star" : i % 3 === 0 ? "sparkle" : i % 2 === 0 ? "diamond" : "circle"
          });
        }
      } else if (activeEffect === "stars") {
        const count = 65;
        for (let i = 0; i < count; i++) {
          newParticles.push({
            id: i,
            origin: "random",
            left: Math.random() * 96 + 2,
            size: Math.floor(Math.random() * 16) + 10,
            color: "#FBBF24",
            delay: Math.random() * 0.7,
            duration: 3.2 + Math.random() * 1.5,
            rotation: Math.floor(Math.random() * 360),
            iconType: "star"
          });
        }
      } else {
        const countPerSide = 50;
        // Left cannon
        for (let i = 0; i < countPerSide; i++) {
          const angleDeg = -20 - Math.random() * 55;
          const angleRad = (angleDeg * Math.PI) / 180;
          const distance = 450 + Math.random() * 650;
          newParticles.push({
            id: i,
            origin: "left",
            targetX: Math.cos(angleRad) * distance,
            targetY: Math.sin(angleRad) * distance,
            size: Math.floor(Math.random() * 14) + 8,
            color: COLORS[Math.floor(Math.random() * COLORS.length)] || "#FBBF24",
            delay: Math.random() * 0.45,
            duration: 2.2 + Math.random() * 1.3,
            rotation: Math.floor(Math.random() * 360),
            iconType: i % 4 === 0 ? "star" : i % 3 === 0 ? "sparkle" : i % 2 === 0 ? "diamond" : "ribbon"
          });
        }
        // Right cannon
        for (let i = 0; i < countPerSide; i++) {
          const angleDeg = -105 - Math.random() * 55;
          const angleRad = (angleDeg * Math.PI) / 180;
          const distance = 450 + Math.random() * 650;
          newParticles.push({
            id: countPerSide + i,
            origin: "right",
            targetX: Math.cos(angleRad) * distance,
            targetY: Math.sin(angleRad) * distance,
            size: Math.floor(Math.random() * 14) + 8,
            color: COLORS[Math.floor(Math.random() * COLORS.length)] || "#FBBF24",
            delay: Math.random() * 0.45,
            duration: 2.2 + Math.random() * 1.3,
            rotation: Math.floor(Math.random() * 360),
            iconType: i % 4 === 0 ? "star" : i % 3 === 0 ? "sparkle" : i % 2 === 0 ? "diamond" : "ribbon"
          });
        }
      }

      setParticles(newParticles);

      const timer = setTimeout(() => {
        setVisible(false);
        if (onComplete) onComplete();
      }, 4200);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [trigger, activeEffect]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {/* 1. Fireworks Burst (Center Radial Expansion) */}
      {activeEffect === "fireworks" && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute flex items-center justify-center opacity-0 animate-fireworks"
              style={{
                ["--target-x" as any]: `${p.targetX}px`,
                ["--target-y" as any]: `${p.targetY}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                color: p.color
              }}
            >
              {p.iconType === "star" ? <Star className="fill-current drop-shadow-md" style={{ width: p.size, height: p.size }} /> : <Sparkles className="drop-shadow-md" style={{ width: p.size, height: p.size }} />}
            </div>
          ))}
        </div>
      )}

      {/* 2. Sparkles Rain (Full-Screen Falling Glitter) */}
      {activeEffect === "rain" && (
        <div className="absolute inset-0 z-40">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute flex items-center justify-center opacity-0 animate-sparkle-rain"
              style={{
                left: `${p.left}%`,
                top: `-20px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                color: p.color
              }}
            >
              {p.iconType === "star" ? <Star className="fill-current drop-shadow-md" style={{ width: p.size, height: p.size }} /> : <Sparkles className="drop-shadow-md" style={{ width: p.size, height: p.size }} />}
            </div>
          ))}
        </div>
      )}

      {/* 3. Floating Stars */}
      {activeEffect === "stars" && (
        <div className="absolute inset-0 z-40">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute opacity-0 animate-sparkle-stars"
              style={{
                left: `${p.left}%`,
                bottom: `-20px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                color: p.color
              }}
            >
              <Star className="fill-current text-amber-400 drop-shadow-lg" style={{ width: p.size, height: p.size }} />
            </div>
          ))}
        </div>
      )}

      {/* 4. Party Poppers (Diagonal Corner Cannons) */}
      {(activeEffect === "poppers" || !activeEffect) && (
        <>
          {/* Bottom Left Cannon */}
          <div className="absolute bottom-4 left-4 z-40">
            {particles.filter(p => p.origin === "left").map((p) => (
              <div
                key={p.id}
                className="absolute flex items-center justify-center opacity-0 animate-popper-left"
                style={{
                  ["--target-x" as any]: `${p.targetX}px`,
                  ["--target-y" as any]: `${p.targetY}px`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  color: p.color
                }}
              >
                {p.iconType === "star" && <Star className="fill-current drop-shadow-md" style={{ width: p.size, height: p.size }} />}
                {p.iconType === "sparkle" && <Sparkles className="drop-shadow-md" style={{ width: p.size, height: p.size }} />}
                {p.iconType === "diamond" && <Zap className="fill-current drop-shadow-md" style={{ width: p.size * 0.9, height: p.size * 0.9 }} />}
                {p.iconType === "ribbon" && (
                  <div 
                    className="rounded-xs shadow-sm"
                    style={{ 
                      width: p.size * 1.2, 
                      height: p.size * 0.5, 
                      backgroundColor: p.color,
                      transform: `rotate(${p.rotation}deg)`,
                      boxShadow: `0 0 10px ${p.color}`
                    }} 
                  />
                )}
              </div>
            ))}
          </div>

          {/* Bottom Right Cannon */}
          <div className="absolute bottom-4 right-4 z-40">
            {particles.filter(p => p.origin === "right").map((p) => (
              <div
                key={p.id}
                className="absolute flex items-center justify-center opacity-0 animate-popper-right"
                style={{
                  ["--target-x" as any]: `${p.targetX}px`,
                  ["--target-y" as any]: `${p.targetY}px`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  color: p.color
                }}
              >
                {p.iconType === "star" && <Star className="fill-current drop-shadow-md" style={{ width: p.size, height: p.size }} />}
                {p.iconType === "sparkle" && <Sparkles className="drop-shadow-md" style={{ width: p.size, height: p.size }} />}
                {p.iconType === "diamond" && <Zap className="fill-current drop-shadow-md" style={{ width: p.size * 0.9, height: p.size * 0.9 }} />}
                {p.iconType === "ribbon" && (
                  <div 
                    className="rounded-xs shadow-sm"
                    style={{ 
                      width: p.size * 1.2, 
                      height: p.size * 0.5, 
                      backgroundColor: p.color,
                      transform: `rotate(${p.rotation}deg)`,
                      boxShadow: `0 0 10px ${p.color}`
                    }} 
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
