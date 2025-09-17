type LogLevel = "debug" | "info" | "warn" | "error";

interface ILogger {
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

export class LoggerService implements ILogger {
	private readonly component: string;
	private readonly minLevel: LogLevel;

	private static readonly LOG_LEVELS: Record<LogLevel, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	};

	constructor(component: string, minLevel: LogLevel = "info") {
		this.component = component;
		this.minLevel = minLevel;
	}

	private shouldLog(level: LogLevel): boolean {
		return (
			LoggerService.LOG_LEVELS[level] >= LoggerService.LOG_LEVELS[this.minLevel]
		);
	}

	private formatMessage(level: LogLevel, message: string): string {
		const timestamp = new Date().toISOString();
		return `[${timestamp}] [${level.toUpperCase()}] [${this.component}] ${message}`;
	}

	debug(message: string, ...args: unknown[]): void {
		if (this.shouldLog("debug")) {
			console.debug(this.formatMessage("debug", message), ...args);
		}
	}

	info(message: string, ...args: unknown[]): void {
		if (this.shouldLog("info")) {
			console.info(this.formatMessage("info", message), ...args);
		}
	}

	warn(message: string, ...args: unknown[]): void {
		if (this.shouldLog("warn")) {
			console.warn(this.formatMessage("warn", message), ...args);
		}
	}

	error(message: string, ...args: unknown[]): void {
		if (this.shouldLog("error")) {
			console.error(this.formatMessage("error", message), ...args);
		}
	}

	static create(component: string, minLevel: LogLevel = "info"): LoggerService {
		return new LoggerService(component, minLevel);
	}
}
