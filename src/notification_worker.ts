import { infrai } from "./infrai";

async function pollNotifications(): Promise<void> {
  const queue = process.env.INFRAI_QUEUE;
  if (!queue) throw new Error("Set INFRAI_QUEUE to the notification queue name");
  const batch = await infrai.queue.consume(queue, 10, 30);
  console.log(`Notification worker received ${batch.items?.length ?? 0} message(s)`);
}

pollNotifications().catch(async (error: unknown) => {
  const failure = error instanceof Error ? error : new Error(String(error));
  await infrai.errors.capture(
    {
      title: "Patient notification worker failed",
      message: failure.message,
      level: "error",
      fingerprint: ["patient-notification-worker", "consume"],
      exception: failure.stack ?? failure.message,
      context: { worker: "patient-notification" },
    },
    `notification-worker-${Date.now()}`,
  );
  console.error(failure.message);
  process.exitCode = 1;
});
