export type IPersistenceClient = {
	getItem<T>(key: string): Promise<T | null>;
	setItem<T>(key: string, value: T): Promise<void>;
	removeItem(key: string): Promise<void>;
	clear(): Promise<void>;
	getAllKeys(): Promise<string[]>;
};
