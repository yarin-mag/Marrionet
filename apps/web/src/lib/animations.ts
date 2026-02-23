/**
 * Reusable animation utilities for fancy UI components
 * Uses Tailwind CSS classes for GPU-accelerated animations
 */

export const animations = {
  // Pulse for active status badges
  pulse: "animate-pulse",

  // Shimmer effect for hover
  shimmer: "hover:animate-[shimmer_2s_ease-in-out_infinite]",

  // Bounce for new notifications
  bounce: "animate-bounce",

  // Fade in on mount
  fadeIn: "animate-[fadeIn_0.5s_ease-out]",

  // Slide in from right (for stats)
  slideInRight: "animate-[slideInRight_0.3s_ease-out]",

  // Scale on hover
  hoverScale: "transition-transform hover:scale-105 duration-200",

  // Glow pulse
  glowPulse: "animate-[glowPulse_2s_ease-in-out_infinite]",

  // Fade in with delay
  fadeInDelay: (delay: number) => `animate-[fadeIn_0.5s_ease-out_${delay}ms]`,
} as const;

/**
 * Keyframes for custom animations
 * Add these to your globals.css file in an @layer utilities block
 */
export const keyframesCSS = `
@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes glowPulse {
  0%, 100% {
    box-shadow: 0 0 10px var(--glow-color);
  }
  50% {
    box-shadow: 0 0 25px var(--glow-color);
  }
}
`;
