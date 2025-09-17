import {
	Account,
	type AccountDTO,
	type ProviderId,
} from "@/domain/entities/Account";
import type { CreateVaultDTO, VaultDTO } from "@/domain/entities/Vault";
import type { AccountRepository } from "@/infrastructure/repositories/AccountRepository";

export class AccountService {
	constructor(private readonly accountRepository: AccountRepository) {}

	async listAccounts(): Promise<AccountDTO[]> {
		const accounts = await this.accountRepository.getAll();
		return accounts.map((account) => account.toDto());
	}

	async removeAccount(accountId: string): Promise<void> {
		const account = await this.accountRepository.getById(accountId);
		if (!account) {
			throw new Error("Account not found");
		}

		await this.accountRepository.delete(accountId);
	}

	async getAccount(accountId: string): Promise<AccountDTO | null> {
		const account = await this.accountRepository.getById(accountId);
		if (!account) return null;

		return account.toDto();
	}

	async updateAccountName(accountId: string, newName: string): Promise<void> {
		const account = await this.accountRepository.getById(accountId);
		if (!account) {
			throw new Error("Account not found");
		}

		account.name = newName;
		await this.accountRepository.save(account);
	}

	async createAccount(providerType: ProviderId): Promise<void> {
		const newAccount = Account.create(providerType);
		const authDto = await this.accountRepository.authenticate(newAccount);
		newAccount.login(authDto);
		await this.accountRepository.save(newAccount);
	}

	async authenticateAccount(accountId: string): Promise<void> {
		const account = await this.accountRepository.getById(accountId);
		if (!account) {
			throw new Error("Account not found");
		}

		const authDto = await this.accountRepository.authenticate(account);
		account.login(authDto);
		await this.accountRepository.save(account);
	}

	async logoutAccount(accountId: string): Promise<void> {
		const account = await this.accountRepository.getById(accountId);
		await this.accountRepository.logout(account);
		account.logout();
		await this.accountRepository.save(account);
	}

	async createVault(accountId: string, dto: CreateVaultDTO): Promise<void> {
		const account = await this.accountRepository.getById(accountId);
		if (!account) {
			throw new Error("Account not found");
		}

		account.createVault(dto);
		await this.accountRepository.save(account);
	}

	async deleteVault(accountId: string, vaultId: string): Promise<void> {
		const account = await this.accountRepository.getById(accountId);
		if (!account) {
			throw new Error("Account not found");
		}

		account.deleteVault(vaultId);
		await this.accountRepository.save(account);
	}

	async getVault(accountId: string, vaultId: string): Promise<VaultDTO | null> {
		const account = await this.accountRepository.getById(accountId);
		if (!account) {
			throw new Error("Account not found");
		}

		const vault = account.getVault(vaultId);
		return vault ? vault.toDto() : null;
	}

	async saveVault(
		accountId: string,
		vaultData: Partial<VaultDTO>,
	): Promise<void> {
		const account = await this.accountRepository.getById(accountId);
		if (!account) {
			throw new Error("Account not found");
		}

		if (vaultData.id) {
			account.updateVault(vaultData.id, vaultData);
		} else {
			account.createVault(vaultData as CreateVaultDTO);
		}

		await this.accountRepository.save(account);
	}
}
