import type { IPersistenceClient } from "@/infrastructure/api/persistence/IPersistenceClient";
import { LoggerService } from "@/infrastructure/services/LoggerService";

export class LocalStorageClient implements IPersistenceClient {
	private readonly logger = LoggerService.create("LocalStorageClient");
	async getItem<T>(key: string): Promise<T | null> {
		try {
			const value = localStorage.getItem(key);
			return value ? JSON.parse(value) : null;
		} catch (error) {
			this.logger.error("Failed to get item from localStorage", error);
			return null;
		}
	}

	async setItem<T>(key: string, value: T): Promise<void> {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch (error) {
			this.logger.error("Failed to set item in localStorage", error);
			throw error;
		}
	}

	async removeItem(key: string): Promise<void> {
		try {
			localStorage.removeItem(key);
		} catch (error) {
			this.logger.error("Failed to remove item from localStorage", error);
			throw error;
		}
	}

	async clear(): Promise<void> {
		try {
			localStorage.clear();
		} catch (error) {
			this.logger.error("Failed to clear localStorage", error);
			throw error;
		}
	}

	async getAllKeys(): Promise<string[]> {
		try {
			return Object.keys(localStorage);
		} catch (error) {
			this.logger.error("Failed to get keys from localStorage", error);
			return [];
		}
	}
}
