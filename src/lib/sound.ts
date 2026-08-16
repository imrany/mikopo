// Notification alert sound utility using Web Audio API
// Synthesizes a clean, pleasant notification chime without external file dependencies.

const SOUND_MUTED_KEY = "app_notification_sound_muted";

export function isNotificationSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem(SOUND_MUTED_KEY) === "true" ||
    localStorage.getItem("microfinance_notification_sound_muted") === "true"
  );
}

export function setNotificationSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_MUTED_KEY, muted ? "true" : "false");
}

export function playNotificationSound(): void {
  if (typeof window === "undefined") return;
  if (isNotificationSoundMuted()) return;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // If context is suspended (due to browser autoplay policies before user interaction)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Harmonic two-tone notification bell (E5 -> A5 chime)
    const tones = [
      { freq: 659.25, start: now, duration: 0.15 }, // E5
      { freq: 880.0, start: now + 0.12, duration: 0.35 }, // A5
    ];

    tones.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Sine wave with subtle triangle overtone for warm acoustic bell timbre
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      // Volume envelope: fast attack, smooth exponential decay
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration + 0.05);
    });
  } catch (err) {
    console.warn("Unable to play notification alert sound:", err);
  }
}
