type LogLevel = "info" | "warn" | "error";
type LogValue = string | number | boolean | null | undefined;

const allowedContextKeys = new Set([
  "code",
  "database",
  "environment",
  "errorName",
  "latencyMs",
  "orderId",
  "paymentId",
  "preferenceId",
  "providerStatus",
  "reason",
  "requestId",
  "result",
  "status",
  "type",
]);

export function sanitizeLogContext(context: Record<string, LogValue> = {}) {
  return Object.fromEntries(
    Object.entries(context)
      .filter(([key, value]) => allowedContextKeys.has(key) && value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === "string"
          ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 160)
          : value,
      ]),
  );
}

export function logEvent(level: LogLevel, event: string, context: Record<string, LogValue> = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeLogContext(context),
  });

  console[level](entry);
}
