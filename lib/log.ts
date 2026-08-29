/**
 * lib/log.ts
 * Structured JSON logging — Vercel logs รับ 1 บรรทัด JSON ต่อ event ค้นด้วย field ได้ง่าย
 *
 * ⚠️ ห้าม log ข้อความลูกค้าแบบเต็ม (PII) — log แค่ metadata (ความยาว, finishReason, latency ฯลฯ)
 */

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  [key: string]: string | number | boolean | undefined | null;
}

function write(level: LogLevel, event: string, ctx?: LogContext) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...ctx,
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const log = {
  info: (event: string, ctx?: LogContext) => write("info", event, ctx),
  warn: (event: string, ctx?: LogContext) => write("warn", event, ctx),
  error: (event: string, ctx?: LogContext) => write("error", event, ctx),
};
