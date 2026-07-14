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
    Object.entries(context).filter(
      ([key, value]) => allowedContextKeys.has(key) && value !== undefined,
    ),
  );
}

export function logEvent(
  level: LogLevel,
  event: string,
  context: Record<string, LogValue> = {},
) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeLogContext(context),
  });

  console[level](entry);
}
