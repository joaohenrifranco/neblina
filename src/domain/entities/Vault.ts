import { isUUID } from "@/infrastructure/utils/uuid";

export type CreateVaultDTO = {
	name: string;
	mountPath: string[];
	password: string;
	password2?: string;
	filenameEncryption?: "standard" | "obfuscate" | "off";
};

export type VaultDTO = {
	id: string;
	accountId: string;
	createdAt: string;
	updatedAt: string;
} & CreateVaultDTO;

export class Vault {
	constructor(readonly dto: VaultDTO) {
		if (!dto.name?.trim()) {
			throw new Error("Vault name is required");
		}
		if (!dto.password?.trim()) {
			throw new Error("Vault password is required");
		}
		if (!isUUID(dto.id)) {
			throw new Error("Vault ID must be a valid UUID");
		}
	}

	get id(): string {
		return this.dto.id;
	}

	get accountId(): string {
		return this.dto.accountId;
	}

	get mountPath(): string[] {
		return this.dto.mountPath;
	}

	get name(): string {
		return this.dto.name;
	}

	get password(): string {
		return this.dto.password;
	}

	get password2(): string | undefined {
		return this.dto.password2;
	}

	get filenameEncryption(): "standard" | "obfuscate" | "off" | null {
		return this.dto.filenameEncryption ?? null;
	}

	toDto(): VaultDTO {
		return this.dto;
	}

	static create(dto: {
		accountId: string;
		name: string;
		mountPath: string[];
		password: string;
		password2?: string;
		filenameEncryption: "standard" | "obfuscate" | "off";
	}): Vault {
		return new Vault({
			...dto,
			password: dto.password,
			password2: dto.password2,
			id: crypto.randomUUID(),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	}
}
