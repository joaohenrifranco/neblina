import {
	Account,
	type AccountDTO,
	type OAuthDTO,
	type ProviderId,
} from "@/domain/entities/Account";
import type { IAuthAPI } from "@/infrastructure/api/auth/IAuthAPI";
import type { LocalStorageClient } from "@/infrastructure/api/persistence/LocalStorageClient";
import type { EncryptionService } from "@/infrastructure/services/EncryptionService";
import { LoggerService } from "@/infrastructure/services/LoggerService";

export class AccountRepository {
	private readonly STORAGE_KEY = "cloud-accounts";
	private readonly logger = LoggerService.create("AccountRepository");

	constructor(
		private readonly localStorage: LocalStorageClient,
		private readonly cloudAuthAPIs: Map<ProviderId, IAuthAPI>,
		private readonly encryptionService: EncryptionService,
	) {}

	async getAll(): Promise<Account[]> {
		try {
			const data = await this.localStorage.getItem<string>(this.STORAGE_KEY);
			if (!data) return [];

			const accountsData: AccountDTO[] = JSON.parse(data);
			const decodedAccountsData = await Promise.all(
				accountsData.map(async (accountDto) => ({
					...accountDto,
					vaults: await Promise.all(
						accountDto.vaults.map(async (vault) => ({
							...vault,
							password: await this.revealVaultPassword(vault.password),
							password2: vault.password2
								? await this.revealVaultPassword(vault.password2)
								: undefined,
						})),
					),
				})),
			);
			return decodedAccountsData.map((dto) => new Account(dto));
		} catch (error) {
			this.logger.error("Failed to get all cloud accounts", error);
			return [];
		}
	}

	async getById(id: string): Promise<Account> {
		const accounts = await this.getAll();

		const account = accounts.find((p) => p.id === id);

		if (!account) {
			throw new Error("Account not found");
		}

		return account;
	}

	async getByName(name: string): Promise<Account | null> {
		try {
			const accounts = await this.getAll();
			return accounts.find((p) => p.name === name) || null;
		} catch (error) {
			this.logger.error("Failed to get account by name", error);
			return null;
		}
	}

	async save(account: Account): Promise<void> {
		try {
			const accounts = await this.getAll();
			const existingIndex = accounts.findIndex((p) => p.id === account.id);

			if (existingIndex >= 0) {
				accounts[existingIndex] = account;
			} else {
				accounts.push(account);
			}

			const encodedAccountsData = await Promise.all(
				accounts.map(async (p) => {
					const accountDto = p.toDto();
					return {
						...accountDto,
						vaults: await Promise.all(
							accountDto.vaults.map(async (vault) => ({
								...vault,
								password: await this.obscureVaultPassword(vault.password),
								password2: vault.password2
									? await this.obscureVaultPassword(vault.password2)
									: undefined,
							})),
						),
					};
				}),
			);

			await this.localStorage.setItem(
				this.STORAGE_KEY,
				JSON.stringify(encodedAccountsData),
			);
		} catch (error) {
			this.logger.error("Failed to save account", error);
			throw error;
		}
	}

	async delete(id: string): Promise<void> {
		try {
			const accounts = await this.getAll();
			const filteredAccounts = accounts.filter((p) => p.id !== id);

			const encodedAccountsData = await Promise.all(
				filteredAccounts.map(async (p) => {
					const accountDto = p.toDto();
					return {
						...accountDto,
						vaults: await Promise.all(
							accountDto.vaults.map(async (vault) => ({
								...vault,
								password: await this.obscureVaultPassword(vault.password),
								password2: vault.password2
									? await this.obscureVaultPassword(vault.password2)
									: undefined,
							})),
						),
					};
				}),
			);

			await this.localStorage.setItem(
				this.STORAGE_KEY,
				JSON.stringify(encodedAccountsData),
			);
		} catch (error) {
			this.logger.error("Failed to delete account", error);
			throw error;
		}
	}

	async authenticate(account: Account): Promise<OAuthDTO> {
		const authAPI = this.cloudAuthAPIs.get(account.providerId);
		if (!authAPI) {
			throw new Error(
				`No auth API registered for account type: ${account.providerId}`,
			);
		}

		const oauthDto = await authAPI.authenticate();
		return oauthDto;
	}

	async logout(account: Account): Promise<void> {
		const authAPI = this.cloudAuthAPIs.get(account.providerId);
		if (!authAPI) {
			throw new Error(
				`No auth API registered for account type: ${account.providerId}`,
			);
		}
		if (account.oauthData?.accessToken) {
			await authAPI.revoke(account.oauthData);
		}
	}

	private async obscureVaultPassword(password: string): Promise<string> {
		if (!password) return "";
		if (this.encryptionService.isPasswordObscured(password)) {
			return password;
		}
		return await this.encryptionService.obscurePassword(password);
	}

	private async revealVaultPassword(password: string): Promise<string> {
		if (!password) return "";
		if (this.encryptionService.isPasswordObscured(password)) {
			return await this.encryptionService.revealPassword(password);
		}
		return password;
	}
}
