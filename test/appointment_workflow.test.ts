import assert from "node:assert/strict";
import test from "node:test";
import { appointmentRequest, decideAppointmentChange } from "../src/appointment_workflow";

test("suppresses patient notification when contact consent is absent", () => {
  const change = appointmentRequest.parse({
    appointmentId: "apt-1042",
    patientId: "pat-88",
    previousStatus: "scheduled",
    nextStatus: "cancelled",
    startsAt: "2026-09-15T09:30:00.000Z",
    patientContactAllowed: false,
  });

  assert.deepEqual(decideAppointmentChange(change), {
    appointmentId: "apt-1042",
    state: "cancelled",
    notification: "none",
  });
});
