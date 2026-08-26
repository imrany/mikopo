import type confetti from "canvas-confetti";

export async function fireConfetti(options?: confetti.Options) {
  if (typeof window === "undefined") return;
  try {
    const confettiModule = await import("canvas-confetti");
    const confettiFn = confettiModule.default || confettiModule;
    confettiFn({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      zIndex: 9999,
      ...options,
    });
  } catch (err) {
    console.error("Confetti error:", err);
  }
}

/** Burst from left and right edges for major milestones (account creation, loan repayment, loan activation) */
export async function fireCelebrationConfetti() {
  if (typeof window === "undefined") return;
  try {
    const confettiModule = await import("canvas-confetti");
    const confettiFn = confettiModule.default || confettiModule;
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confettiFn({
        particleCount: 5,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        zIndex: 9999,
        colors: ["#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#8B5CF6"],
      });
      confettiFn({
        particleCount: 5,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.7 },
        zIndex: 9999,
        colors: ["#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#8B5CF6"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  } catch (err) {
    console.error("Celebration confetti error:", err);
  }
}
