import type { AccountDTO } from "@/domain/entities/Account";
import type {
	IProviderAPI,
	ProviderFileDTO,
} from "@/infrastructure/api/provider/IProviderAPI";
import { getFixedSizeChunk } from "@/infrastructure/utils/stream";

interface GooglePickerAPI {
	picker: {
		PickerBuilder: new () => {
			setOAuthToken(token: string): any;
			setAppId(appId: string): any;
			addView(view: any): any;
			setCallback(callback: (data: any) => void): any;
			enableFeature(feature: any): any;
			setTitle(title: string): any;
			build(): { setVisible(visible: boolean): void };
		};
		DocsView: new (viewId: string) => {
			setIncludeFolders(include: boolean): any;
			setSelectFolderEnabled(enabled: boolean): any;
			setMimeTypes(mimeTypes: string): any;
		};
		ViewId: {
			FOLDERS: string;
		};
		Feature: {
			NAV_HIDDEN: string;
		};
	};
}

declare global {
	interface Window {
		google: GooglePickerAPI;
	}
}

const RESPONSE_CODES = {
	resumeIncomplete: 308,
	ok: 200,
	created: 201,
	notFound: 404,
};

const REQUEST_CHUNK_SIZE_BYTES = 128 * 1024 * 1024;

export class GoogleDriveAPI implements IProviderAPI {
	static type: "gdrive" = "gdrive";

	async listFiles(
		path: string[],
		account: AccountDTO,
	): Promise<ProviderFileDTO[]> {
		const folderId = await this.getPathId(path, account);
		if (!folderId) {
			throw new Error(`Path not found: ${path.join("/")}`);
		}

		const response = await gapi.client.drive.files.list({
			access_token: account.oauthData?.accessToken,
			pageSize: 50,
			fields: "files(id, name, mimeType, size, createdTime, modifiedTime)",
			orderBy: "name",
			q: `'${folderId}' in parents and trashed = false`,
		});

		if (!response.result || !response.result.files) {
			throw new Error(
				`[DriveAPI] Failed to list files: ${JSON.stringify(response.result)}`,
			);
		}

		const files = response.result.files.map((f) => ({
			providedId: f.id,
			type:
				f.mimeType === "application/vnd.google-apps.folder"
					? ("folder" as const)
					: ("file" as const),
			sizeBytes: f.size,
			createdAt: f.createdTime,
			modifiedAt: f.modifiedTime,
			mimeType: f.mimeType,
			path: [...path, f.name],
		})) as ProviderFileDTO[];

		return files.sort((a, b) => {
			if (a.type === "folder" && b.type !== "folder") return -1;
			if (a.type !== "folder" && b.type === "folder") return 1;
			return (a.path.join("/") || "").localeCompare(b.path.join("/") || "");
		});
	}

	async uploadFile(
		stream: ReadableStream,
		path: string[],
		account: AccountDTO,
	): Promise<void> {
		const pathParts = [...path];
		const name = pathParts.pop()!;
		const folderId = await this.getPathId(pathParts, account);
		if (!folderId) {
			throw new Error(`Path not found: ${pathParts.join("/")}`);
		}

		const fileMetadata = {
			name,
			parents: [folderId],
		};

		const createResponse = await fetch(
			"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${account.oauthData?.accessToken}`,
					"Content-Type": "application/json",
					"Content-Length": "0",
				},
				body: JSON.stringify(fileMetadata),
			},
		);

		const sessionUri = createResponse.headers.get("Location");

		if (!sessionUri) {
			throw new Error("[DRIVE_API] Drive API did not return a session URI");
		}

		const reader = stream.getReader();
		const chunkGenerator = getFixedSizeChunk(reader, REQUEST_CHUNK_SIZE_BYTES);
		await this.uploadStream(sessionUri, chunkGenerator, 0, null);
	}

	downloadFile(
		dto: ProviderFileDTO,
		account: AccountDTO,
	): Promise<ReadableStream> {
		return new Promise((resolve) =>
			fetch(
				`https://www.googleapis.com/drive/v3/files/${dto.providedId}?alt=media`,
				{
					headers: {
						Authorization: `Bearer ${account.oauthData?.accessToken}`,
					},
				},
			).then((response) => resolve(response.body!)),
		);
	}

	async createFolder(
		path: string[],
		account: AccountDTO,
		createMissing: boolean = false,
	): Promise<string> {
		const pathParts = [...path];
		const name = pathParts.pop()!;

		const parentId = await this.getPathId(pathParts, account, createMissing);
		if (!parentId) {
			throw new Error(`Parent path not found: ${pathParts.join("/")}`);
		}
		return await this.createFolderAtParent(name, parentId, account);
	}

	async getPathId(
		path: string[],
		account: AccountDTO,
		createMissing: boolean = false,
	): Promise<string | null> {
		if (path.length === 0) return "root";

		const parentPath = path.slice(0, -1);
		const folderName = path[path.length - 1];
		const parentId = await this.getPathId(parentPath, account, createMissing);
		if (!parentId) return null;

		const response = await gapi.client.drive.files.list({
			access_token: account.oauthData?.accessToken,
			q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed = false`,
		});

		const existingFolder = response.result.files?.[0];

		if (existingFolder?.id) {
			return existingFolder.id;
		} else if (createMissing) {
			return await this.createFolderAtParent(folderName, parentId, account);
		} else {
			return null;
		}
	}

	private async createFolderAtParent(
		name: string,
		parentId: string,
		account: AccountDTO,
	): Promise<string> {
		const response = await gapi.client.drive.files.create({
			access_token: account.oauthData?.accessToken,
			resource: {
				name,
				mimeType: "application/vnd.google-apps.folder",
				parents: [parentId],
			},
		});

		if (!response.result || !response.result.id) {
			throw new Error(
				`[DriveAPI] Failed to create folder: ${JSON.stringify(response.result)}`,
			);
		}

		return response.result.id;
	}

	async deleteObjects(
		dtos: ProviderFileDTO[],
		account: AccountDTO,
	): Promise<void> {
		await Promise.all(
			dtos.map((path) =>
				gapi.client.drive.files.delete({
					fileId: path.providedId,
					access_token: account.oauthData?.accessToken,
				}),
			),
		);
	}

	async openFolderPicker(account: AccountDTO): Promise<string[] | null> {
		return new Promise((resolve) => {
			if (!account.oauthData?.accessToken) {
				throw new Error("Account is not authenticated");
			}

			if (window.google?.picker) {
				this.createFolderPicker(account, resolve);
			} else {
				gapi.load('picker', {
					callback: () => this.createFolderPicker(account, resolve),
				});
			}
		});
	}

	private createFolderPicker(
		account: AccountDTO,
		resolve: (path: string[] | null) => void
	): void {
		const appId = '1028248986339';

		const picker = new window.google.picker.PickerBuilder()
			.setOAuthToken(account.oauthData!.accessToken)
			.setAppId(appId)
			.addView(new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
				.setIncludeFolders(true)
				.setSelectFolderEnabled(true)
				.setMimeTypes('application/vnd.google-apps.folder'))
			.setCallback((data: any) => {
				if (data.action === 'picked' && data.docs && data.docs.length > 0) {
					const selectedFolder = data.docs[0];
					this.getFolderPath(selectedFolder.id, account).then(resolve);
				} else if (data.action === 'cancel') {
					resolve(null);
				}
			})
			.enableFeature(window.google.picker.Feature.NAV_HIDDEN)
			.setTitle('Select Vault Folder')
			.build();

		picker.setVisible(true);
	}

	private async getFolderPath(folderId: string, account: AccountDTO): Promise<string[]> {
		if (folderId === 'root') {
			return [];
		}

		const response = await gapi.client.drive.files.get({
			fileId: folderId,
			fields: 'name,parents',
			access_token: account.oauthData?.accessToken,
		});

		const folder = response.result;
		if (!folder.name) {
			throw new Error('Unable to get folder name');
		}

		const path = [folder.name];

		if (folder.parents && folder.parents.length > 0) {
			const parentPath = await this.getFolderPath(folder.parents[0], account);
			return [...parentPath, ...path];
		}

		return path;
	}

	private async uploadStream(
		sessionUri: string,
		chunkGenerator: AsyncGenerator<Uint8Array, void>,
		readOffset: number,
		unsentBuffer: Uint8Array | null,
	) {
		if (!unsentBuffer) {
			unsentBuffer = new Uint8Array(0);
		}

		const askedChunkSize = REQUEST_CHUNK_SIZE_BYTES - unsentBuffer.byteLength;
		const readResult = await chunkGenerator.next(askedChunkSize);

		if (readResult.done) {
			return;
		}

		const readChunk = readResult.value;
		const totalBytesRead = readOffset + readChunk.byteLength;

		const requestBuffer = new Uint8Array(
			unsentBuffer.byteLength + readChunk.byteLength,
		);
		requestBuffer.set(unsentBuffer, 0);
		requestBuffer.set(readChunk, unsentBuffer.byteLength);

		const unknown = "*";
		const isLast = readChunk.byteLength !== REQUEST_CHUNK_SIZE_BYTES;
		const contentRangeTotal = isLast ? totalBytesRead.toString() : unknown;

		const chunkResponse = await fetch(sessionUri, {
			method: "PUT",
			headers: {
				"Content-Length": readChunk.byteLength.toString(),
				"Content-Range": `bytes ${readOffset}-${totalBytesRead - 1}/${contentRangeTotal}`,
			},
			body: requestBuffer,
		});

		let unsentBytes = 0;
		if (chunkResponse.status === RESPONSE_CODES.resumeIncomplete) {
			const lastByte = parseInt(
				chunkResponse.headers.get("Range")?.split("-")[1] ?? "0",
				10,
			);
			const bytesSent = lastByte + 1;
			unsentBytes = totalBytesRead - bytesSent;
		}
		if (unsentBytes > 0) {
			const unsentBuffer = requestBuffer.subarray(
				requestBuffer.length - unsentBytes,
			);
			await this.uploadStream(
				sessionUri,
				chunkGenerator,
				totalBytesRead,
				unsentBuffer,
			);
			return;
		}
		await this.uploadStream(sessionUri, chunkGenerator, totalBytesRead, null);
	}
}
