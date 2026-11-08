import { randomUUID } from "node:crypto";
import { z } from "zod";

export const appointmentRequest = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  previousStatus: z.enum(["scheduled", "confirmed", "cancelled"]),
  nextStatus: z.enum(["scheduled", "confirmed", "cancelled"]),
  startsAt: z.string().datetime(),
  patientContactAllowed: z.boolean(),
});

export type AppointmentChange = z.infer<typeof appointmentRequest>;

export type WorkflowResult = {
  appointmentId: string;
  state: AppointmentChange["nextStatus"];
  notification: "confirmation" | "cancellation" | "none";
};

export function decideAppointmentChange(change: AppointmentChange): WorkflowResult {
  const notification = !change.patientContactAllowed
    ? "none"
    : change.nextStatus === "cancelled"
      ? "cancellation"
      : change.previousStatus !== "confirmed" && change.nextStatus === "confirmed"
        ? "confirmation"
        : "none";

  return { appointmentId: change.appointmentId, state: change.nextStatus, notification };
}

export function errorPayload(change: AppointmentChange, error: unknown): Record<string, unknown> {
  const failure = error instanceof Error ? error : new Error(String(error));
  return {
    title: "Appointment workflow failed",
    message: failure.message,
    level: "error",
    fingerprint: ["appointment-transition", change.previousStatus, change.nextStatus],
    exception: failure.stack ?? failure.message,
    context: {
      appointmentId: change.appointmentId,
      patientId: change.patientId,
      startsAt: change.startsAt,
    },
  };
}

export function captureId(change: AppointmentChange): string {
  return `appointment-${change.appointmentId}-${randomUUID()}`;
}
