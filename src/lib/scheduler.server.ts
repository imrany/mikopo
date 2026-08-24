let isSchedulerRunning = false;
let schedulerInterval: NodeJS.Timeout | null = null;

export async function runOverdueAndReminderMaintenance() {
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
  }
}

export function initBackgroundScheduler() {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  console.log("[Scheduler] Initializing 24-Hour Overdue Loan Reminder & Maintenance Job...");

  // Run initial scan shortly after startup
  setTimeout(() => {
    runOverdueAndReminderMaintenance().catch(console.error);
  }, 3000);

  // Run periodic maintenance every 10 minutes to ensure 24h intervals are accurately respected
  schedulerInterval = setInterval(
    () => {
      runOverdueAndReminderMaintenance().catch(console.error);
    },
    10 * 60 * 1000,
  );

  if (
    typeof schedulerInterval === "object" &&
    schedulerInterval !== null &&
    "unref" in schedulerInterval
  ) {
    schedulerInterval.unref();
  }
}
