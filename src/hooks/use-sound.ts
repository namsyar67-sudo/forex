"use client";

/**
 * Sound Notification Hook
 * Plays sound alerts for trading signals and trade events.
 * Uses Web Audio API to generate tones (no external sound files needed).
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

// Play a tone with given frequency, duration, and start delay
function playTone(freq: number, duration: number, delay: number = 0, volume: number = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.value = freq;
  oscillator.type = "sine";

  const startTime = ctx.currentTime + delay;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// Sound patterns for different event types
export function playSignalSound() {
  // New high-confidence signal — ascending 3-note chime
  playTone(523.25, 0.15, 0, 0.3);     // C5
  playTone(659.25, 0.15, 0.12, 0.3);  // E5
  playTone(783.99, 0.3, 0.24, 0.3);   // G5
}

export function playTPHitSound() {
  // Take profit hit — happy ascending chime
  playTone(523.25, 0.12, 0, 0.25);
  playTone(659.25, 0.12, 0.1, 0.25);
  playTone(783.99, 0.12, 0.2, 0.25);
  playTone(1046.50, 0.3, 0.3, 0.3);   // C6
}

export function playSLHitSound() {
  // Stop loss hit — descending warning
  playTone(440, 0.15, 0, 0.3);        // A4
  playTone(349.23, 0.15, 0.12, 0.3);  // F4
  playTone(293.66, 0.3, 0.24, 0.3);   // D4
}

export function playNewsAlertSound() {
  // Breaking news / high-impact news — urgent double beep
  playTone(880, 0.1, 0, 0.3);
  playTone(880, 0.1, 0.15, 0.3);
}

export function playBreakingNewsSound() {
  // Breaking news — urgent triple beep
  playTone(1000, 0.08, 0, 0.35);
  playTone(1000, 0.08, 0.12, 0.35);
  playTone(1000, 0.08, 0.24, 0.35);
}

export function playTradeUpdateSound() {
  // Trade update (confidence change, BOS, etc.) — soft notification
  playTone(660, 0.1, 0, 0.2);
  playTone(880, 0.15, 0.08, 0.2);
}

export function playCloseTradeSound() {
  // Trade closed — completion sound
  playTone(783.99, 0.1, 0, 0.25);
  playTone(659.25, 0.1, 0.08, 0.25);
  playTone(523.25, 0.25, 0.16, 0.25);
}
