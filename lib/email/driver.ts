import nodemailer from "nodemailer";

type EmailMessage = { to: string; subject: string; text: string; html: string; eventId: string };

export function getEmailDriverName() {
  return process.env.EMAIL_DRIVER?.trim().toLowerCase() || "disabled";
}

export function isEmailDriverReady() {
  const driver = getEmailDriverName();
  if (driver === "development") return process.env.NODE_ENV !== "production";
  if (driver === "smtp") {
    return Boolean(
      process.env.EMAIL_FROM?.trim() &&
      process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      Number.isInteger(Number(process.env.SMTP_PORT ?? "465")),
    );
  }
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
  if (driver === "smtp") {
    const from = process.env.EMAIL_FROM?.trim();
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const port = Number(process.env.SMTP_PORT ?? "465");
    if (!from || !host || !user || !pass || !Number.isInteger(port)) {
      throw new Error("EMAIL_PROVIDER_CONFIG_MISSING");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE?.trim().toLowerCase() !== "false",
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      tls: { minVersion: "TLSv1.2" },
    });
    try {
      await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        messageId: `<${message.eventId}@braga-commerce.local>`,
      });
    } finally {
      transporter.close();
    }
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
