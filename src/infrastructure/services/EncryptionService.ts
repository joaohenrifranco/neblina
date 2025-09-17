import { LoggerService } from "@/infrastructure/services/LoggerService";

export type FilenameEncryptionMode = "standard";

interface WasmEncryptionMessage {
	id: string;
	type:
		| "encryptFilename"
		| "decryptFilename"
		| "encryptStream"
		| "decryptStream"
		| "obscurePassword"
		| "revealPassword";
	password?: string;
	salt?: string;
	filename?: string;
	encryptedFilename?: string;
	stream?: ReadableStream;
	obscuredPassword?: string;
}

interface WasmEncryptionResponse {
	id: string;
	success: boolean;
	result?: string | ReadableStream;
	error?: string;
}

export class EncryptionService {
	private readonly logger = LoggerService.create("EncryptionService");
	private wasmWorker: Worker | null = null;
	private initializationPromise: Promise<void> | null = null;
	private pendingStringOperations = new Map<
		string,
		{ resolve: (value: string) => void; reject: (error: Error) => void }
	>();

	private pendingStreamOperations = new Map<
		string,
		{ resolve: (value: ReadableStream) => void; reject: (error: Error) => void }
	>();

	async initialize(): Promise<void> {
		if (!this.initializationPromise) {
			this.initializationPromise = this.createWorker();
		}
		return this.initializationPromise;
	}

	private async createWorker(): Promise<void> {
		if (this.wasmWorker) {
			return;
		}

		this.wasmWorker = new Worker(
			new URL("./RcloneWasmWorker.ts", import.meta.url),
			{ type: "module" },
		);

		this.wasmWorker.onmessage = (
			event: MessageEvent<WasmEncryptionResponse>,
		) => {
			const { id, success, result, error } = event.data;
			const stringOperation = this.pendingStringOperations.get(id);
			const streamOperation = this.pendingStreamOperations.get(id);

			if (stringOperation) {
				this.pendingStringOperations.delete(id);
				if (success && result !== undefined) {
					stringOperation.resolve(result as string);
				} else {
					stringOperation.reject(new Error(error || "Unknown error"));
				}
			} else if (streamOperation) {
				this.pendingStreamOperations.delete(id);
				if (success && result !== undefined) {
					streamOperation.resolve(result as ReadableStream);
				} else {
					streamOperation.reject(new Error(error || "Unknown error"));
				}
			}
		};

		this.wasmWorker.onerror = (error) => {
			this.logger.error("WASM Worker error", error);
		};

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("Worker initialization timeout after 10 seconds"));
			}, 10000);

			const handler = (event: MessageEvent) => {
				if (event.data.type === "ready") {
					clearTimeout(timeout);
					this.wasmWorker!.removeEventListener("message", handler);
					resolve();
				} else if (event.data.type === "error") {
					clearTimeout(timeout);
					this.wasmWorker!.removeEventListener("message", handler);
					reject(
						new Error(`Worker initialization failed: ${event.data.error}`),
					);
				}
			};

			this.wasmWorker!.addEventListener("message", handler);
		});
	}

	private async sendToWorker(
		type: WasmEncryptionMessage["type"],
		options: Omit<WasmEncryptionMessage, "id" | "type">,
	): Promise<string> {
		if (!this.wasmWorker) {
			throw new Error("WASM worker not initialized");
		}

		const id = crypto.randomUUID();
		const message: WasmEncryptionMessage = {
			id,
			type,
			...options,
		};

		return new Promise((resolve, reject) => {
			this.pendingStringOperations.set(id, { resolve, reject });
			this.wasmWorker!.postMessage(message);

			setTimeout(() => {
				if (this.pendingStringOperations.has(id)) {
					this.pendingStringOperations.delete(id);
					reject(new Error("Operation timeout"));
				}
			}, 30000);
		});
	}

	private async sendToWorkerWithTransfer(
		type: WasmEncryptionMessage["type"],
		options: Omit<WasmEncryptionMessage, "id" | "type">,
		transferList: Transferable[],
	): Promise<ReadableStream> {
		if (!this.wasmWorker) {
			throw new Error("WASM worker not initialized");
		}

		const id = crypto.randomUUID();
		const message: WasmEncryptionMessage = {
			id,
			type,
			...options,
		};

		return new Promise((resolve, reject) => {
			this.pendingStreamOperations.set(id, { resolve, reject });
			this.wasmWorker!.postMessage(message, transferList);

			setTimeout(() => {
				if (this.pendingStreamOperations.has(id)) {
					this.pendingStreamOperations.delete(id);
					reject(new Error("Operation timeout"));
				}
			}, 30000);
		});
	}

	async encryptFilename(
		filename: string,
		password: string,
		_mode: FilenameEncryptionMode = "standard",
		salt?: string,
	): Promise<string> {
		if (filename === "") {
			return "";
		}

		await this.initialize();
		return this.sendToWorker("encryptFilename", { filename, password, salt });
	}

	async decryptFilename(
		encryptedFilename: string,
		password: string,
		_mode: FilenameEncryptionMode = "standard",
		salt?: string,
	): Promise<string> {
		if (encryptedFilename === "") {
			return "";
		}

		await this.initialize();
		return this.sendToWorker("decryptFilename", {
			encryptedFilename,
			password,
			salt,
		});
	}

	async encryptStream(
		stream: ReadableStream,
		password: string,
		salt?: string,
	): Promise<ReadableStream> {
		await this.initialize();
		return this.sendToWorkerWithTransfer(
			"encryptStream",
			{ stream, password, salt },
			[stream],
		);
	}

	async decryptStream(
		encryptedStream: ReadableStream,
		password: string,
		salt?: string,
	): Promise<ReadableStream> {
		await this.initialize();
		return this.sendToWorkerWithTransfer(
			"decryptStream",
			{ stream: encryptedStream, password, salt },
			[encryptedStream],
		);
	}

	async obscurePassword(password: string): Promise<string> {
		if (!password) return "";

		await this.initialize();
		return this.sendToWorker("obscurePassword", { password });
	}

	async revealPassword(obscuredPassword: string): Promise<string> {
		if (!obscuredPassword) return "";

		await this.initialize();
		return this.sendToWorker("revealPassword", { obscuredPassword });
	}

	isPasswordObscured(password: string): boolean {
		if (!password) return false;

		const rcloneObscuredRegex = /^[A-Za-z0-9_-]+$/;
		return rcloneObscuredRegex.test(password) && password.length > 10;
	}

	destroy(): void {
		if (this.wasmWorker) {
			this.wasmWorker.terminate();
			this.wasmWorker = null;
		}
		this.pendingStringOperations.clear();
		this.pendingStreamOperations.clear();
		this.initializationPromise = null;
	}
}
