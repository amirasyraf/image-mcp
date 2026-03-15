/**
 * Lightweight structured logger that writes to stderr.
 *
 * All output goes to stderr to avoid interfering with the MCP stdio protocol,
 * which uses stdout for client ↔ server communication.
 *
 * Log format:
 *   [<ISO timestamp>] [<LEVEL>] <message> <JSON context>
 */

type LogContext = Record<string, unknown>;

function log(level: string, msg: string, ctx?: LogContext): void {
  const ts = new Date().toISOString();
  const ctxStr = ctx && Object.keys(ctx).length > 0 ? " " + JSON.stringify(ctx) : "";
  process.stderr.write(`[${ts}] [${level}] ${msg}${ctxStr}\n`);
}

export const logger = {
  /** Fine-grained diagnostic information */
  debug: (msg: string, ctx?: LogContext) => log("DEBUG", msg, ctx),
  /** General operational events */
  info:  (msg: string, ctx?: LogContext) => log("INFO ", msg, ctx),
  /** Non-fatal issues worth investigating */
  warn:  (msg: string, ctx?: LogContext) => log("WARN ", msg, ctx),
  /** Errors that caused an operation to fail */
  error: (msg: string, ctx?: LogContext) => log("ERROR", msg, ctx),
};

/**
 * Extract a loggable error context object from an unknown thrown value.
 * Includes the stack trace when available.
 */
export function fmtError(err: unknown): LogContext {
  if (err instanceof Error) {
    const ctx: LogContext = { error: err.message };
    if (err.stack) ctx.stack = err.stack;
    return ctx;
  }
  return { error: String(err) };
}

/**
 * Truncate a string for log output (keeps entries readable for long prompts).
 */
export function trunc(str: string, maxLen = 120): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + `… (+${str.length - maxLen} chars)`;
}
