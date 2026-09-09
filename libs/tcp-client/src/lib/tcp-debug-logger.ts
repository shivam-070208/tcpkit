import { appendFileSync } from 'node:fs';

export type TcpLogLevel = 'info' | 'debug' | 'error';

export class TcpDebugLogger {
  private readonly enabled: boolean;
  private readonly logFile: string | null;

  constructor(enabled = false, logFile: string | null = null) {
    this.enabled = enabled || process.env.TCPKIT_DEBUG === '1';
    this.logFile = logFile || (process.env.TCPKIT_LOG_FILE as string) || null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  log(level: TcpLogLevel, message: string, data?: unknown): void {
    if (!this.enabled) return;
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] ${message}${data !== undefined ? ` ${this.formatData(data)}` : ''}`;
    try {
      process.stderr.write(`${formatted}\n`);
    } catch {}
    if (this.logFile) {
      try {
        appendFileSync(this.logFile, `${formatted}\n`);
      } catch {}
    }
  }

  private formatData(data: unknown): string {
    try {
      if (typeof data === 'string') return data;
      if (Buffer.isBuffer(data))
        return `Buffer(${data.length}): ${data.subarray(0, 200).toString('utf8')}${data.length > 200 ? '...' : ''}`;
      return JSON.stringify(data).slice(0, 2000);
    } catch {
      return String(data);
    }
  }
}
