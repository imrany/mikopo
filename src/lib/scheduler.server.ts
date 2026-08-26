let isSchedulerRunning = false;
let isExecutionInProgress = false;
let schedulerInterval: NodeJS.Timeout | null = null;

export async function runOverdueAndReminderMaintenance() {
  if (isExecutionInProgress) {
    // Prevent overlapping execution if previous maintenance cycle is still running
    return;
  }

  isExecutionInProgress = true;
  try {
    const { reconcileOverdueLoans, revertStuckDisbursingLoans } = await import("./loans.server");
    const { send24HourOverdueDefaulterReminders } = await import("./notifications.server");

    // 1. Revert any stuck disbursing loans (older than 3 min)
    await revertStuckDisbursingLoans();

    // 2. Reconcile overdue loans, transition to defaulted, apply 24hr penalties
    await reconcileOverdueLoans();

    // 3. Check and dispatch 24-hour overdue reminders for loan defaulters
    const reminderResult = await send24HourOverdueDefaulterReminders();
    if (reminderResult.remindersDispatched > 0) {
      console.log(
        `[Scheduler] 24-Hour Overdue Defaulter Reminders Dispatched: ${reminderResult.remindersDispatched} of ${reminderResult.totalDefaultersChecked} defaulters.`,
      );
    }
  } catch (err) {
    console.error("[Scheduler Maintenance Error]:", err);
  } finally {
    isExecutionInProgress = false;
  }
}

export function initBackgroundScheduler() {
  if (isSchedulerRunning) return;
  if (process.env.DISABLE_BACKGROUND_SCHEDULER === "true") {
    console.log("[Scheduler] Background scheduler disabled by environment variable.");
    return;
  }
  isSchedulerRunning = true;

  const intervalMinutes = parseInt(process.env.SCHEDULER_INTERVAL_MINUTES || "10", 10);
  const intervalMs = Math.max(1, isNaN(intervalMinutes) ? 10 : intervalMinutes) * 60 * 1000;

  console.log(
    `[Scheduler] Initializing 24-Hour Overdue Loan Reminder & Maintenance Job (Interval: ${intervalMinutes}m)...`,
  );

  // Run initial scan shortly after startup (5 seconds delay)
  setTimeout(() => {
    runOverdueAndReminderMaintenance().catch(console.error);
  }, 5000);

  // Run periodic maintenance
  schedulerInterval = setInterval(() => {
    runOverdueAndReminderMaintenance().catch(console.error);
  }, intervalMs);

  if (
    typeof schedulerInterval === "object" &&
    schedulerInterval !== null &&
    "unref" in schedulerInterval
  ) {
    schedulerInterval.unref();
  }
}
