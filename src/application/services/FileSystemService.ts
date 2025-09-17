import type { Account } from "@/domain/entities/Account";
import {
	FileSystemObject,
	type FileSystemObjectDTO,
} from "@/domain/entities/FileSystemObject";
import { Vault } from "@/domain/entities/Vault";
import type { AccountRepository } from "@/infrastructure/repositories/AccountRepository";
import type { FileRepository } from "@/infrastructure/repositories/FileSystemRepository";
import {
	Task,
	type TaskQueueService,
} from "@/infrastructure/services/TaskQueueService";

export class FileSystemService {
	constructor(
		private readonly fileRepository: FileRepository,
		private readonly accountRepository: AccountRepository,
		private readonly taskQueue: TaskQueueService,
	) {}

	private async getAccountAndVault(
		vaultId: string,
	): Promise<{ account: Account; vault: Vault }> {
		const accounts = await this.accountRepository.getAll();

		for (const account of accounts) {
			const vaultDto = account.vaults.find((v) => v.id === vaultId);
			if (vaultDto) {
				return { account, vault: new Vault(vaultDto) };
			}
		}

		throw new Error("Vault not found");
	}

	async listFiles(
		vaultId: string,
		path: string[],
	): Promise<FileSystemObjectDTO[] | null> {
		const { account, vault } = await this.getAccountAndVault(vaultId);
		const files = await this.fileRepository.listVaultFiles(
			account,
			vault,
			path,
		);
		return files ? files.map((file) => file.toDto()) : null;
	}

	async checkMountPathExists(vaultId: string): Promise<boolean> {
		const { account, vault } = await this.getAccountAndVault(vaultId);
		return await this.fileRepository.checkMountPath(account, vault);
	}

	async createMountPath(vaultId: string): Promise<void> {
		const { account, vault } = await this.getAccountAndVault(vaultId);
		await this.fileRepository.createMountPath(account, vault);
	}

	async uploadFiles(
		vaultId: string,
		parentPath: string[],
		files: FileList,
	): Promise<void> {
		const { account, vault } = await this.getAccountAndVault(vaultId);
		for (const file of Array.from(files)) {
			const task = new Task({
				type: "upload",
				target: file.name,
				vaultId,
				executor: async () => {
					await this.fileRepository.uploadVaultFile(
						account,
						vault,
						file.stream(),
						[...parentPath, file.name],
					);
				},
			});

			this.taskQueue.addTask(task);
		}
	}

	async downloadFiles(
		vaultId: string,
		files: FileSystemObjectDTO[],
	): Promise<{ filename: string; blob: Blob }[]> {
		const { account, vault } = await this.getAccountAndVault(vaultId);
		const results: { filename: string; blob: Blob }[] = [];

		for (const fileDto of files) {
			const file = new FileSystemObject(fileDto);
			const decryptedStream = await this.fileRepository.downloadVaultFile(
				account,
				vault,
				file,
			);

			const response = new Response(decryptedStream);
			const blob = await response.blob();

			results.push({
				filename: fileDto.path[fileDto.path.length - 1],
				blob: blob,
			});
		}

		return results;
	}

	async deleteObjects(
		vaultId: string,
		files: FileSystemObjectDTO[],
	): Promise<void> {
		const { account } = await this.getAccountAndVault(vaultId);
		const fileEntities = files.map((dto) => new FileSystemObject(dto));

		this.taskQueue.addTask(
			new Task({
				type: "delete",
				target: `Delete ${files.length} files`,
				vaultId,
				executor: async () => {
					await this.fileRepository.deleteVaultFiles(account, fileEntities);
				},
			}),
		);
	}

	async createFolder(vaultId: string, path: string[]): Promise<void> {
		const { account, vault } = await this.getAccountAndVault(vaultId);

		this.taskQueue.addTask(
			new Task({
				type: "create_folder",
				target: `Create folder "${path.join("/")}"`,
				vaultId,
				executor: async () => {
					await this.fileRepository.createVaultFolder(account, vault, path);
				},
			}),
		);
	}

}
