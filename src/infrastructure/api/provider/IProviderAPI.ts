import type { AccountDTO } from "@/domain/entities/Account";

export type ProviderFileDTO = {
	providedId: string;
	path: string[];
	type: "folder" | "file";
	sizeBytes?: number;
	createdAt?: string;
	modifiedAt?: string;
	mimeType?: string;
};

export type IProviderAPI = {
	listFiles(path: string[], account: AccountDTO): Promise<ProviderFileDTO[]>;
	uploadFile(
		stream: ReadableStream,
		path: string[],
		account: AccountDTO,
	): Promise<void>;
	downloadFile(
		object: ProviderFileDTO,
		account: AccountDTO,
	): Promise<ReadableStream>;
	deleteObjects(objects: ProviderFileDTO[], account: AccountDTO): Promise<void>;
	createFolder(
		path: string[],
		account: AccountDTO,
		createMissing: boolean,
	): Promise<string>;
	getPathId(
		path: string[],
		account: AccountDTO,
		createMissing?: boolean,
	): Promise<string | null>;
	openFolderPicker(account: AccountDTO): Promise<string[] | null>;
};
