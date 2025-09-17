import { AccountService } from "@/application/services/AccountService";
import { FileSystemService } from "@/application/services/FileSystemService";
import type { ProviderId } from "@/domain/entities/Account";
import { GoogleAuthAPI } from "@/infrastructure/api/auth/GoogleAuthAPI";
import type { IAuthAPI } from "@/infrastructure/api/auth/IAuthAPI";
import { LocalStorageClient } from "@/infrastructure/api/persistence/LocalStorageClient";
import { GoogleDriveAPI } from "@/infrastructure/api/provider/GoogleDriveAPI";
import type { IProviderAPI } from "@/infrastructure/api/provider/IProviderAPI";
import { AccountRepository } from "@/infrastructure/repositories/AccountRepository";
import { FileRepository } from "@/infrastructure/repositories/FileSystemRepository";
import { EncryptionService } from "@/infrastructure/services/EncryptionService";
import { TaskQueueService } from "@/infrastructure/services/TaskQueueService";

export class ServicesContainer {
	public readonly taskQueueService: TaskQueueService;
	public readonly accountService: AccountService;
	public readonly filesService: FileSystemService;

	constructor() {
		const localStorage = new LocalStorageClient();
		const encryptionService = new EncryptionService();
		this.taskQueueService = new TaskQueueService();

		const cloudAuthAPIs = new Map<ProviderId, IAuthAPI>();
		const providerAPIs = new Map<ProviderId, IProviderAPI>();

		cloudAuthAPIs.set(GoogleAuthAPI.type, new GoogleAuthAPI());
		providerAPIs.set(GoogleDriveAPI.type, new GoogleDriveAPI());

		const accountRepository = new AccountRepository(
			localStorage,
			cloudAuthAPIs,
			encryptionService,
		);
		const fileRepository = new FileRepository(encryptionService, providerAPIs);

		this.accountService = new AccountService(accountRepository, providerAPIs);
		this.filesService = new FileSystemService(
			fileRepository,
			accountRepository,
			this.taskQueueService,
		);
	}

	async init() {
		await GoogleAuthAPI.init();
	}
}
