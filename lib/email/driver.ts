type EmailMessage = { to: string; subject: string; text: string; html: string; eventId: string };

export function getEmailDriverName() {
  return process.env.EMAIL_DRIVER?.trim().toLowerCase() || "disabled";
}

export function isEmailDriverReady() {
  const driver = getEmailDriverName();
  if (driver === "development") return process.env.NODE_ENV !== "production";
  return (
    driver === "resend" &&
    Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim())
  );
}

export async function sendEmail(message: EmailMessage) {
  const driver = getEmailDriverName();
  if (driver === "development" && process.env.NODE_ENV !== "production") {
    console.info(JSON.stringify({ event: "email.development.accepted", eventId: message.eventId }));
    return;
  }
  if (driver !== "resend") throw new Error("EMAIL_DRIVER_UNAVAILABLE");
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("EMAIL_PROVIDER_CONFIG_MISSING");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.eventId,
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });
  if (!response.ok) throw new Error(`EMAIL_PROVIDER_${response.status}`);
}
