import type { Account } from "@/domain/entities/Account";
import { FileSystemObject } from "@/domain/entities/FileSystemObject";
import type { Vault } from "@/domain/entities/Vault";
import type { IProviderAPI } from "@/infrastructure/api/provider/IProviderAPI";
import type {
	EncryptionService,
	FilenameEncryptionMode,
} from "@/infrastructure/services/EncryptionService";
import { LoggerService } from "@/infrastructure/services/LoggerService";

export class FileRepository {
	private readonly logger = LoggerService.create("FileRepository");
	constructor(
		private readonly encryptionService: EncryptionService,
		private readonly providerApis: Map<string, IProviderAPI>,
	) {}

	async listVaultFiles(
		account: Account,
		vault: Vault,
		path: string[],
	): Promise<FileSystemObject[] | null> {
		const providerAPI = this.providerApis.get(account.providerId);
		if (!providerAPI) {
			throw new Error(
				`No provider API registered for type: ${account.providerId}`,
			);
		}

		const completePath = await this.getEncryptedFullPath(vault, path);
		const pathId = await providerAPI.getPathId(completePath, account.toDto());

		if (!pathId) {
			this.logger.warn("Path ID not found for path", completePath);
			return null;
		}

		const encryptedFiles = await providerAPI.listFiles(
			completePath,
			account.toDto(),
		);

		const files: FileSystemObject[] = [];
		const filenameMode: FilenameEncryptionMode = "standard";

		for (const encryptedFile of encryptedFiles) {
			const decryptedPath: string[] = [];
			decryptedPath.push(...vault.mountPath);

			for (let i = vault.mountPath.length; i < encryptedFile.path.length; i++) {
				const encryptedSegment = encryptedFile.path[i];
				const decryptedSegment = await this.encryptionService.decryptFilename(
					encryptedSegment,
					vault.password,
					filenameMode,
					vault.password2,
				);
				decryptedPath.push(decryptedSegment);
			}

			const file = new FileSystemObject({
				...encryptedFile,
				path: decryptedPath,
			});

			files.push(file);
		}

		return files;
	}

	async uploadVaultFile(
		account: Account,
		vault: Vault,
		stream: ReadableStream,
		path: string[],
	): Promise<void> {
		const providerAPI = this.providerApis.get(account.providerId);
		if (!providerAPI) {
			throw new Error(
				`No provider API registered for type: ${account.providerId}`,
			);
		}

		const encryptedPath = await this.getEncryptedFullPath(vault, path);

		const encryptedContent = await this.encryptionService.encryptStream(
			stream,
			vault.password,
			vault.password2,
		);

		await providerAPI.uploadFile(
			encryptedContent,
			encryptedPath,
			account.toDto(),
		);
	}

	async downloadVaultFile(
		account: Account,
		vault: Vault,
		object: FileSystemObject,
	): Promise<ReadableStream> {
		const providerAPI = this.providerApis.get(account.providerId);
		if (!providerAPI) {
			throw new Error(
				`No provider API registered for type: ${account.providerId}`,
			);
		}

		const encryptedStream = await providerAPI.downloadFile(
			object.toDto(),
			account.toDto(),
		);

		return await this.encryptionService.decryptStream(
			encryptedStream,
			vault.password,
			vault.password2,
		);
	}

	async deleteVaultFiles(
		account: Account,
		objects: FileSystemObject[],
	): Promise<void> {
		const providerAPI = this.providerApis.get(account.providerId);
		if (!providerAPI) {
			throw new Error(
				`No provider API registered for type: ${account.providerId}`,
			);
		}
		await providerAPI.deleteObjects(
			objects.map((obj) => obj.toDto()),
			account.toDto(),
		);
	}

	async createVaultFolder(
		account: Account,
		vault: Vault,
		path: string[],
	): Promise<string> {
		const providerAPI = this.providerApis.get(account.providerId);
		if (!providerAPI) {
			throw new Error(
				`No provider API registered for type: ${account.providerId}`,
			);
		}

		const encryptedPath = await this.getEncryptedFullPath(vault, path);

		return await providerAPI.createFolder(
			encryptedPath,
			account.toDto(),
			false,
		);
	}

	async checkMountPath(account: Account, vault: Vault): Promise<boolean> {
		const providerAPI = this.providerApis.get(account.providerId);
		if (!providerAPI) {
			return false;
		}

		const pathId = await providerAPI.getPathId(
			vault.mountPath,
			account.toDto(),
		);
		return pathId !== null;
	}

	async createMountPath(account: Account, vault: Vault): Promise<void> {
		const providerAPI = this.providerApis.get(account.providerId);
		if (!providerAPI) {
			throw new Error(
				`No provider API registered for type: ${account.providerId}`,
			);
		}

		await providerAPI.createFolder(vault.mountPath, account.toDto(), true);
	}

	private async getEncryptedFullPath(
		vault: Vault,
		path: string[],
	): Promise<string[]> {
		const filenameMode: FilenameEncryptionMode = "standard";

		const encryptedPath = await Promise.all(
			path.map(async (p) => {
				const encrypted = await this.encryptionService.encryptFilename(
					p,
					vault.password,
					filenameMode,
					vault.password2,
				);
				return encrypted;
			}),
		);

		const fullPath = [...vault.mountPath, ...encryptedPath];
		return fullPath;
	}
}
