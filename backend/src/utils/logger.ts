interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = this.getTimestamp();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${dataStr}`;
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage(LOG_LEVELS.DEBUG, message, data));
    }
  }

  info(message: string, data?: any): void {
    console.info(this.formatMessage(LOG_LEVELS.INFO, message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage(LOG_LEVELS.WARN, message, data));
  }

  error(message: string, data?: any): void {
    console.error(this.formatMessage(LOG_LEVELS.ERROR, message, data));
  }
}

export const logger = new Logger(); 