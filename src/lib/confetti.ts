import confetti from "canvas-confetti";

export function fireConfetti(options?: confetti.Options) {
  if (typeof window === "undefined") return;
  try {
    confetti({
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
export function fireCelebrationConfetti() {
  if (typeof window === "undefined") return;
  try {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.7 },
        zIndex: 9999,
        colors: ["#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#8B5CF6"],
      });
      confetti({
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
