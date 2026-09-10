export const BADGE_PRESETS: Record<string, { label: string; class: string; description: string }> = {
  gold: { label: "Golden Star", class: "bg-gradient-to-tr from-yellow-400 via-amber-300 to-yellow-600 animate-pulse", description: "Golden glowing aura" },
  rainbow: { label: "Rainbow Spinner", class: "bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-500 animate-spin", description: "Multi-color spinning gradient ring" },
  emerald: { label: "Emerald Neon", class: "bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 animate-pulse", description: "Vibrant emerald green glow" },
  rose: { label: "Rose Diamond", class: "bg-gradient-to-r from-rose-400 via-pink-500 to-purple-600 animate-pulse", description: "Elegant pink-rose diamond aura" },
  indigo: { label: "Cyber Blue", class: "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 animate-spin", description: "Futuristic spinning blue-indigo ring" },
  primary: { label: "Primary Glow", class: "bg-primary shadow-[0_0_15px_rgba(var(--primary),0.5)] animate-pulse", description: "Soft primary color glow" },
  none: { label: "None", class: "", description: "No avatar ring" }
};

export const CELEBRATION_PRESETS: Record<string, { label: string; description: string }> = {
  poppers: { label: "Party Poppers", description: "Diagonal confetti cannons firing from bottom corners" },
  rain: { label: "Sparkles Rain", description: "Full-screen cascading glitter and starburst rain" },
  fireworks: { label: "Fireworks Burst", description: "Explosive radial starburst expanding from screen center" },
  stars: { label: "Floating Stars", description: "Gentle floating golden stars & glowing diamond aura" },
  none: { label: "None", description: "No celebration animation on login" }
};
