import { redactSensitive } from "./redact.js";

export interface LogFields {
  [key: string]: unknown;
}

function write(level: "info" | "warn" | "error", message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...fields
  });

  const redacted = redactSensitive(line);
  if (level === "error") {
    console.error(redacted);
  } else {
    console.log(redacted);
  }
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields)
};
