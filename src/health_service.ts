import { createServer } from "node:http";
import { ZodError } from "zod";
import { appointmentRequest, captureId, decideAppointmentChange, errorPayload } from "./appointment_workflow";
import { InfraiError, infrai } from "./infrai";

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/appointments/transition") {
    response.writeHead(404).end(JSON.stringify({ error: "Route not found" }));
    return;
  }

  let change;
  try {
    change = appointmentRequest.parse(await readJson(request));
  } catch (error) {
    const details = error instanceof ZodError ? error.flatten() : { formErrors: ["Body must be valid JSON"] };
    response.writeHead(400).end(JSON.stringify({ error: "Invalid appointment change", details }));
    return;
  }

  try {
    const result = decideAppointmentChange(change);
    response.writeHead(200).end(JSON.stringify(result));
  } catch (error) {
    try {
      await infrai.errors.capture(errorPayload(change, error), captureId(change));
    } catch (captureError) {
      const status = captureError instanceof InfraiError && captureError.status < 500 ? captureError.status : 503;
      response.writeHead(status).end(JSON.stringify({ error: "Operational report was rejected" }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "Appointment transition failed", captured: true }));
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Appointment service listening on http://localhost:${port}`));
