interface WorkerGlobalScope {
	Go: new () => Go;
	createCipher?: (
		password: string,
		salt: string,
	) => { success: boolean; error?: string };
	encryptFilename?: (filename: string) => { result?: string; error?: string };
	decryptFilename?: (filename: string) => { result?: string; error?: string };
	encryptData?: (data: string) => { result?: string; error?: string };
	decryptData?: (data: string) => { result?: string; error?: string };
	obscurePassword?: (password: string) => { result?: string; error?: string };
	revealPassword?: (password: string) => { result?: string; error?: string };
}

interface Go {
	importObject: WebAssembly.Imports;
	run(instance: WebAssembly.Instance): void;
}

interface EncryptionMessage {
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

interface EncryptionResponse {
	id: string;
	success: boolean;
	result?: string | ReadableStream;
	error?: string;
}

class RcloneWasmWorker {
	private wasmReady = false;
	private cipherCache = new Map<string, boolean>();

	async initialize() {
		try {
			console.log("Worker: Starting WASM initialization...");
			await this.loadGoWasmExec();
			console.log("Worker: Go WASM exec loaded");

			console.log("Worker: Fetching rclone.wasm...");
			const wasmResponse = await fetch("/rclone.wasm");
			if (!wasmResponse.ok) {
				throw new Error(
					`Failed to fetch rclone.wasm: ${wasmResponse.status} ${wasmResponse.statusText}`,
				);
			}
			console.log("Worker: rclone.wasm fetched, converting to array buffer...");
			const wasmBytes = await wasmResponse.arrayBuffer();
			console.log(`Worker: Got WASM bytes: ${wasmBytes.byteLength} bytes`);

			console.log("Worker: Creating Go instance...");
			const go = new (self as unknown as { Go: new () => Go }).Go();
			console.log("Worker: Instantiating WASM...");
			const result = await WebAssembly.instantiate(wasmBytes, go.importObject);
			console.log("Worker: WASM instantiated, running Go...");

			go.run(result.instance);

			this.wasmReady = true;
			console.log("Rclone WASM loaded successfully in worker");
		} catch (error) {
			console.error("Failed to load rclone WASM in worker:", error);
			throw error;
		}
	}

	private async loadGoWasmExec(): Promise<void> {
		if ((self as unknown as { Go?: new () => Go }).Go) {
			console.log("Worker: Go already loaded");
			return;
		}

		try {
			console.log("Worker: Fetching wasm_exec.js...");
			const response = await fetch("/wasm_exec.js");
			if (!response.ok) {
				throw new Error(
					`Failed to fetch wasm_exec.js: ${response.status} ${response.statusText}`,
				);
			}
			console.log("Worker: wasm_exec.js fetched, parsing...");
			const scriptText = await response.text();

			console.log("Worker: Executing wasm_exec.js...");
			const scriptFunction = new Function(scriptText);
			scriptFunction.call(self);
			console.log("Worker: wasm_exec.js executed successfully");
		} catch (error) {
			console.error("Failed to load wasm_exec.js:", error);
			throw new Error("Failed to load Go WASM execution support");
		}
	}

	private async ensureCipher(password: string, salt?: string): Promise<void> {
		if (!this.wasmReady) {
			throw new Error("WASM not ready");
		}

		const cacheKey = await this.hashPassword(password + (salt || ""));
		if (this.cipherCache.has(cacheKey)) {
			return;
		}

		const createCipher = (self as unknown as WorkerGlobalScope).createCipher;
		if (typeof createCipher !== "function") {
			throw new Error("createCipher function not available");
		}

		const result = createCipher(password, salt || "");
		if (result.error) {
			throw new Error(result.error);
		}

		this.cipherCache.set(cacheKey, true);
	}

	private async hashPassword(password: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(password);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	async encryptFilename(
		filename: string,
		password: string,
		salt?: string,
	): Promise<string> {
		await this.ensureCipher(password, salt);

		const encryptFilename = (self as unknown as WorkerGlobalScope)
			.encryptFilename;
		if (typeof encryptFilename !== "function") {
			throw new Error("encryptFilename function not available");
		}

		const result = encryptFilename(filename);
		if (result.error) {
			throw new Error(result.error);
		}

		if (!result.result) {
			throw new Error("Unexpected empty result from WASM function");
		}
		return result.result;
	}

	async decryptFilename(
		encryptedFilename: string,
		password: string,
		salt?: string,
	): Promise<string> {
		await this.ensureCipher(password, salt);

		const decryptFilename = (self as unknown as WorkerGlobalScope)
			.decryptFilename;
		if (typeof decryptFilename !== "function") {
			throw new Error("decryptFilename function not available");
		}

		const result = decryptFilename(encryptedFilename);
		if (result.error) {
			throw new Error(result.error);
		}

		if (!result.result) {
			throw new Error("Unexpected empty result from WASM function");
		}
		return result.result;
	}

	async obscurePassword(password: string): Promise<string> {
		if (!this.wasmReady) {
			throw new Error("WASM not ready");
		}

		const obscurePassword = (self as unknown as WorkerGlobalScope)
			.obscurePassword;
		if (typeof obscurePassword !== "function") {
			throw new Error("obscurePassword function not available");
		}

		const result = obscurePassword(password);
		if (result.error) {
			throw new Error(result.error);
		}

		if (!result.result) {
			throw new Error("Unexpected empty result from WASM function");
		}
		return result.result;
	}

	async revealPassword(obscuredPassword: string): Promise<string> {
		if (!this.wasmReady) {
			throw new Error("WASM not ready");
		}

		const revealPassword = (self as unknown as WorkerGlobalScope)
			.revealPassword;
		if (typeof revealPassword !== "function") {
			throw new Error("revealPassword function not available");
		}

		const result = revealPassword(obscuredPassword);
		if (result.error) {
			throw new Error(result.error);
		}

		if (!result.result) {
			throw new Error("Unexpected empty result from WASM function");
		}
		return result.result;
	}

	async encryptStream(
		stream: ReadableStream,
		password: string,
		salt?: string,
	): Promise<ReadableStream> {
		await this.ensureCipher(password, salt);

		const encryptStream = (
			self as unknown as {
				encryptStream?: (stream: ReadableStream) => {
					result?: ReadableStream;
					error?: string;
				};
			}
		).encryptStream;
		if (typeof encryptStream !== "function") {
			throw new Error("encryptStream function not available");
		}

		const result = encryptStream(stream);
		if (result.error) {
			throw new Error(result.error);
		}

		if (!result.result) {
			throw new Error("Unexpected empty result from WASM function");
		}
		return result.result;
	}

	async decryptStream(
		stream: ReadableStream,
		password: string,
		salt?: string,
	): Promise<ReadableStream> {
		await this.ensureCipher(password, salt);

		const decryptStream = (
			self as unknown as {
				decryptStream?: (stream: ReadableStream) => {
					result?: ReadableStream;
					error?: string;
				};
			}
		).decryptStream;
		if (typeof decryptStream !== "function") {
			throw new Error("decryptStream function not available");
		}

		const result = decryptStream(stream);
		if (result.error) {
			throw new Error(result.error);
		}

		if (!result.result) {
			throw new Error("Unexpected empty result from WASM function");
		}
		return result.result;
	}
}

const wasmWorker = new RcloneWasmWorker();

let initializationPromise: Promise<void> | null = null;

const ensureWasmReady = async (): Promise<void> => {
	if (!initializationPromise) {
		initializationPromise = wasmWorker.initialize();
		await initializationPromise;
	} else {
		await initializationPromise;
	}
};

self.onmessage = async (event: MessageEvent<EncryptionMessage>) => {
	const {
		id,
		type,
		password,
		salt,
		filename,
		encryptedFilename,
		stream,
		obscuredPassword,
	} = event.data;

	try {
		let result: string | ReadableStream = "";

		await ensureWasmReady();

		switch (type) {
			case "encryptFilename":
				if (!filename || !password) {
					throw new Error("Filename and password required for encryption");
				}
				result = await wasmWorker.encryptFilename(filename, password, salt);
				break;

			case "decryptFilename":
				if (!encryptedFilename || !password) {
					throw new Error(
						"Encrypted filename and password required for decryption",
					);
				}
				result = await wasmWorker.decryptFilename(
					encryptedFilename,
					password,
					salt,
				);
				break;

			case "encryptStream":
				if (!stream || !password) {
					throw new Error("Stream and password required for encryption");
				}
				result = await wasmWorker.encryptStream(stream, password, salt);
				self.postMessage(
					{ id, success: true, result },
					{ transfer: [result as ReadableStream] },
				);
				return;

			case "decryptStream":
				if (!stream || !password) {
					throw new Error("Stream and password required for decryption");
				}
				result = await wasmWorker.decryptStream(stream, password, salt);
				self.postMessage(
					{ id, success: true, result },
					{ transfer: [result as ReadableStream] },
				);
				return;

			case "obscurePassword":
				if (!password) {
					throw new Error("Password required for obscuration");
				}
				result = await wasmWorker.obscurePassword(password);
				break;

			case "revealPassword":
				if (!obscuredPassword) {
					throw new Error("Obscured password required for revelation");
				}
				result = await wasmWorker.revealPassword(obscuredPassword);
				break;

			default:
				throw new Error(`Unknown operation: ${type}`);
		}

		const response: EncryptionResponse = {
			id,
			success: true,
			result: result,
		};

		self.postMessage(response);
	} catch (error) {
		const response: EncryptionResponse = {
			id,
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};

		self.postMessage(response);
	}
};

(async () => {
	try {
		await ensureWasmReady();
		self.postMessage({ type: "ready" });
	} catch (error) {
		console.error("Worker initialization failed:", error);
		self.postMessage({
			type: "error",
			error: error instanceof Error ? error.message : String(error),
		});
	}
})();
