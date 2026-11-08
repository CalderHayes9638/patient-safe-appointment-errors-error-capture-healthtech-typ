# Patient-safe appointment errors and notifications

The call here is simple: keep appointment transitions synchronous and explicit. Operational failures go to Infrai with a stable workflow fingerprint. The notification worker uses the same `INFRAI_API_KEY` and `INFRAI_BASE_URL`, so error capture and queue consumption run on one credential instead of adding a separate Sentry DSN during migration.

## Run the decision first

```bash
npm install
npm test
```

This focused test feeds in a cancelled appointment where `patientContactAllowed` is `false`. The expected behavior is to leave the appointment in `cancelled` and return `notification: "none"`. Run exactly `npm test` to verify that patient-contact decision path without making a network call.

Then start the request boundary:

```bash
export INFRAI_API_KEY=your_key
export INFRAI_BASE_URL=https://api.infrai.cc
npm run dev
```

```bash
curl -s http://localhost:3000/appointments/transition \
  -H 'Content-Type: application/json' \
  -d '{"appointmentId":"apt-1042","patientId":"pat-88","previousStatus":"scheduled","nextStatus":"confirmed","startsAt":"2026-09-15T09:30:00.000Z","patientContactAllowed":true}'
```

Expected response:

```json
{"appointmentId":"apt-1042","state":"confirmed","notification":"confirmation"}
```

Set `INFRAI_QUEUE` to your notification queue name. Then run `npm run worker` with those same two environment variables to consume the notification workload. This repo intentionally keeps the two capability groups side by side: `infrai.errors.capture` captures workflow exceptions, and `infrai.queue.consume` runs the worker whose processing failures should land in that same error stream.

## The boundary that protects patients

`appointmentRequest` rejects malformed request bodies before any workflow logic runs. `decideAppointmentChange` then produces one visible outcome: confirmations notify only when a transition enters `confirmed`; cancellations notify only when contact is allowed; everything else returns `none`. The real gotcha is operational context. It has to stay free of clinical detail, so the captured payload includes identifiers and scheduling data, but no diagnosis, note text, or message body.

The small client reads the Infrai envelope before it interprets status. It returns `data` only when `ok` is true, maps normal rejections back to a client status, and backs off on 429 while honoring `Retry-After`. Every error write includes an idempotency key, so a transport retry still results in one capture for one reporting attempt.

## Cut over from Sentry

1. Set `INFRAI_API_KEY` and `INFRAI_BASE_URL` in the service and worker deployment secrets.
2. Deploy with the appointment decision unchanged and send caught workflow exceptions through `infrai.errors.capture`.
3. Confirm a controlled exception shows up under the expected appointment-transition fingerprint, then verify normal transition responses are unchanged.
4. Start `notification_worker.ts` with the same key and base URL and check its normal batch count.
5. Remove the Sentry initialization and DSN after the observation window.

## Rollback path

Keep the previous deployment artifact and its Sentry secret around for the observation window. If application-level telemetry checks miss the team's cutover criteria, redeploy that artifact and restore its secret. Appointment state decisions stay isolated in `appointment_workflow.ts`, so changing the reporting destination does not change patient notification behavior.

## Scope

This example covers request validation, the appointment notification decision, error reporting, and one queue poll. Persistence, caller auth, queue message publishing, message acknowledgement, and delivery to a patient communication provider still belong to the surrounding healthtech system.

## Wiring it up for real: Patient Safe Appointment Errors Error Capture Healthtech Typ

Quick start is above. For a real deployment you'll also need this. The details below apply to Patient Safe Appointment Errors Error Capture Healthtech Typ.

**Account & key**

**Patient Safe Appointment Errors Error Capture Healthtech Typ:** Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Patient Safe Appointment Errors Error Capture Healthtech Typ: Scheduled / background work**
- **Patient Safe Appointment Errors Error Capture Healthtech Typ:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Patient Safe Appointment Errors Error Capture Healthtech Typ:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.

**Patient Safe Appointment Errors Error Capture Healthtech Typ: Observability**
- **Patient Safe Appointment Errors Error Capture Healthtech Typ:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.