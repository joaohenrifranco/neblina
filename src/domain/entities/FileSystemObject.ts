export type FileSystemObjectDTO = {
	providedId: string;
	path: string[];
	type: "folder" | "file";
	sizeBytes?: number;
	createdAt?: string;
	modifiedAt?: string;
	mimeType?: string;
};

export class FileSystemObject {
	constructor(readonly dto: FileSystemObjectDTO) {}

	get providedId(): string {
		return this.dto.providedId;
	}

	get path(): string[] {
		return this.dto.path;
	}

	get sizeBytes(): number | undefined {
		return this.dto.sizeBytes;
	}

	get createdAt(): string | undefined {
		return this.dto.createdAt;
	}

	get modifiedAt(): string | undefined {
		return this.dto.modifiedAt;
	}

	get mimeType(): string | undefined {
		return this.dto.mimeType;
	}

	get type(): "folder" | "file" {
		return this.dto.type;
	}

	getDisplaySize(): string | null {
		if (this.type === "folder") return null;
		if (!this.sizeBytes) return null;

		const units = ["B", "KB", "MB", "GB"];
		let size = this.sizeBytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
	}

	getDisplayDate(): string | null {
		if (this.modifiedAt) {
			return new Date(this.modifiedAt).toLocaleDateString();
		}
		return null;
	}

	toDto(): FileSystemObjectDTO {
		return this.dto;
	}
}
