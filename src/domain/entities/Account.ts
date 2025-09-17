import { isUUID } from "@/infrastructure/utils/uuid";
import { type CreateVaultDTO, Vault, type VaultDTO } from "./Vault";

export type ProviderId = "gdrive";

export const PROVIDER_NAMES: Record<ProviderId, string> = {
	gdrive: "Google Drive",
};

export type OAuthDTO = {
	readonly email: string;
	readonly accessToken: string;
	readonly refreshToken?: string;
	readonly expiresAt: string;
};

export type AccountDTO = {
	id: string;
	name: string;
	providerId: ProviderId;
	createdAt: string;
	updatedAt: string;
	oauthData: OAuthDTO | null;
	vaults: VaultDTO[];
};

export class Account {
	constructor(readonly dto: AccountDTO) {
		if (!dto.name?.trim()) {
			throw new Error("Provider name is required");
		}
		if (Object.keys(PROVIDER_NAMES).indexOf(dto.providerId) === -1) {
			throw new Error(`Invalid provider ID: ${dto.providerId}`);
		}
		if (!isUUID(dto.id)) {
			throw new Error("Account ID must be a valid UUID");
		}
		if (!Array.isArray(dto.vaults)) {
			throw new Error("Account vaults must be an array");
		}
	}

	get id(): string {
		return this.dto.id;
	}

	get providerId(): ProviderId {
		return this.dto.providerId;
	}

	get oauthData(): OAuthDTO | null {
		return this.dto.oauthData;
	}

	get name(): string {
		return this.dto.name;
	}

	set name(newName: string) {
		this.dto.name = newName.trim();
	}

	get vaults(): VaultDTO[] {
		return this.dto.vaults;
	}

	login(oauthDto: OAuthDTO): void {
		if (!this.dto.oauthData) {
			this.dto.name = oauthDto.email.split("@")[0];
		}
		this.dto.oauthData = oauthDto;
	}

	logout(): void {
		this.dto.oauthData = null;
	}

	get providerName(): string {
		return PROVIDER_NAMES[this.providerId];
	}

	toDto(): AccountDTO {
		return this.dto;
	}

	createVault(dto: CreateVaultDTO): void {
		const existingVault = this.dto.vaults.find((v) => v.name === dto.name);
		if (existingVault) {
			throw new Error("A vault with this name already exists");
		}

		const vault = Vault.create({
			accountId: this.dto.id,
			name: dto.name,
			mountPath: dto.mountPath,
			password: dto.password,
			password2: dto.password2,
			filenameEncryption: dto.filenameEncryption || "off",
		});

		this.dto.vaults.push(vault.toDto());
		this.dto.updatedAt = new Date().toISOString();
	}

	deleteVault(vaultId: string): void {
		const vaultIndex = this.dto.vaults.findIndex((v) => v.id === vaultId);
		if (vaultIndex === -1) {
			throw new Error("Vault not found");
		}

		this.dto.vaults.splice(vaultIndex, 1);
		this.dto.updatedAt = new Date().toISOString();
	}

	getVault(vaultId: string): Vault | null {
		const vaultDto = this.dto.vaults.find((v) => v.id === vaultId);
		if (!vaultDto) {
			return null;
		}
		return new Vault(vaultDto);
	}

	updateVault(vaultId: string, updates: Partial<CreateVaultDTO>): void {
		const vaultIndex = this.dto.vaults.findIndex((v) => v.id === vaultId);
		if (vaultIndex === -1) {
			throw new Error("Vault not found");
		}

		if (updates.name && updates.name !== this.dto.vaults[vaultIndex].name) {
			const existingVault = this.dto.vaults.find(
				(v) => v.name === updates.name && v.id !== vaultId,
			);
			if (existingVault) {
				throw new Error("A vault with this name already exists");
			}
		}

		Object.assign(this.dto.vaults[vaultIndex], {
			...updates,
			updatedAt: new Date().toISOString(),
		});
		this.dto.updatedAt = new Date().toISOString();
	}

	static create(providerId: ProviderId): Account {
		const id = crypto.randomUUID();
		return new Account({
			id: id,
			providerId: providerId,
			name: PROVIDER_NAMES[providerId],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			oauthData: null,
			vaults: [],
		});
	}
}
