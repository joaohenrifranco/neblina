import { computed, ref } from "vue";
import type { AccountDTO, ProviderId } from "@/domain/entities/Account";
import { PROVIDER_NAMES } from "@/domain/entities/Account";
import type { FileSystemObjectDTO } from "@/domain/entities/FileSystemObject";
import type { VaultDTO } from "@/domain/entities/Vault";
import type {
	Task,
	TaskEventType,
} from "@/infrastructure/services/TaskQueueService";
import { ServicesContainer } from "@/presentation/composables/servicesContainer";
import { toast } from "@/presentation/ui/sonner";

type AccountStatus = "connected" | "expired" | "disconnected";

type FileExplorerState =
	| "no-accounts"
	| "no-vaults"
	| "no-vault-selected"
	| "account-expired"
	| "invalid-mount-path"
	| "folder-not-found"
	| "no-files"
	| "file-list"
	| "loading";

class AppController {
	private readonly svcs = new ServicesContainer();

	public readonly availableProviders = Object.entries(PROVIDER_NAMES).map(
		([id, name]) => ({
			id: id as ProviderId,
			name,
		}),
	);

	public readonly isLoading = ref(false);

	public readonly accounts = ref<AccountDTO[]>([]);
	public readonly currentVault = ref<VaultDTO | null>(null);
	public readonly files = ref<FileSystemObjectDTO[] | null>([]);
	public readonly currentPath = ref<string[]>([]);
	public readonly tasks = ref<Task[]>([]);

	public readonly selectedFileKeys = ref<string[]>([]);

	public readonly editingAccount = ref<AccountDTO | null>(null);
	public readonly editingVault = ref<VaultDTO | null>(null);
	public readonly showCreateFolderDialog = ref(false);
	public readonly showAddAccountDialog = ref(false);

	public readonly hasVaults = computed(() =>
		this.accounts.value.some((account) => account.vaults.length > 0),
	);
	public readonly hasCurrentVault = computed(() => !!this.currentVault.value);

	public readonly fileExplorerState = computed((): FileExplorerState => {
		if (this.isLoading.value) return "loading";
		if (this.accounts.value.length === 0) return "no-accounts";
		if (!this.hasVaults.value) return "no-vaults";
		if (!this.currentVault.value) return "no-vault-selected";

		const vaultAccount = this.accounts.value.find(
			(account) => account.id === this.currentVault.value?.accountId,
		);
		if (vaultAccount && this.getAccountStatus(vaultAccount) === "expired") {
			return "account-expired";
		}

		if (this.files.value === null && this.currentPath.value.length === 0)
			return "invalid-mount-path";
		if (this.files.value === null && this.currentPath.value.length > 0)
			return "folder-not-found";
		if (this.files.value && this.files.value.length === 0) return "no-files";
		return "file-list";
	});

	createAccount = async (providerType: ProviderId) => {
		this.isLoading.value = true;
		try {
			await this.svcs.accountService.createAccount(providerType);
			await this.refreshAccounts();
			this.showAddAccountDialog.value = false;
			this.editingAccount.value = null;
		} finally {
			this.isLoading.value = false;
		}
	};

	authenticateAccount = async (accountId: string) => {
		try {
			this.isLoading.value = true;
			await this.svcs.accountService.authenticateAccount(accountId);
			await this.refreshAccounts();

			if (this.editingAccount.value?.id === accountId) {
				const updatedAccount = this.accounts.value.find(
					(account) => account.id === accountId,
				);
				if (updatedAccount) {
					this.editingAccount.value = updatedAccount;
				}
			}
		} finally {
			this.isLoading.value = false;
		}
	};

	selectVault = async (vault: VaultDTO) => {
		this.isLoading.value = true;
		try {
			this.currentVault.value = vault;
			this.currentPath.value = [];
			await this.refreshFiles();
		} finally {
			this.isLoading.value = false;
		}
	};

	uploadFiles = async (fileList: FileList) => {
		if (!this.currentVault.value?.id) {
			return;
		}

		await this.svcs.filesService.uploadFiles(
			this.currentVault.value.id,
			this.currentPath.value,
			fileList,
		);
	};

	downloadFiles = async (files: FileSystemObjectDTO[]) => {
		if (!this.currentVault.value?.id) {
			return;
		}

		const downloadResults = await this.svcs.filesService.downloadFiles(
			this.currentVault.value.id,
			files,
		);

		for (const result of downloadResults) {
			const url = URL.createObjectURL(result.blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = result.filename;

			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);

			URL.revokeObjectURL(url);
		}
	};

	deleteFiles = async (files: FileSystemObjectDTO[]) => {
		if (!this.currentVault.value?.id) {
			return;
		}

		await this.svcs.filesService.deleteObjects(
			this.currentVault.value.id,
			files,
		);
	};

	refreshFiles = async (path?: string[]) => {
		if (!this.currentVault.value?.id) {
			this.files.value = [];
			return;
		}
		const pathToUse = path || this.currentPath.value;

		try {
			const result = await this.svcs.filesService.listFiles(
				this.currentVault.value.id,
				pathToUse,
			);

			this.files.value = result;
		} catch (error) {
			this.files.value = [];
			throw error;
		}
	};

	navigateToFolder = async (folderName: string) => {
		this.isLoading.value = true;
		this.currentPath.value.push(folderName);
		await this.refreshFiles();
		this.isLoading.value = false;
	};

	navigateToParent = async (pathIndex: number) => {
		this.isLoading.value = true;
		this.currentPath.value = this.currentPath.value.slice(0, pathIndex + 1);
		await this.refreshFiles();
		this.isLoading.value = false;
	};

	createFolder = async (folderName: string) => {
		if (!this.currentVault.value?.id) {
			return false;
		}

		await this.svcs.filesService.createFolder(this.currentVault.value.id, [
			...this.currentPath.value,
			folderName,
		]);
		this.showCreateFolderDialog.value = false;
		return true;
	};

	createMountPath = async () => {
		if (!this.currentVault.value?.id) {
			return false;
		}
		this.isLoading.value = true;

		try {
			await this.svcs.filesService.createMountPath(this.currentVault.value.id);
			await this.refreshFiles();
			this.isLoading.value = false;
			return true;
		} catch (error) {
			this.isLoading.value = false;
			throw error;
		}
	};

	setAddAccountDialog = (show: boolean) => {
		this.showAddAccountDialog.value = show;
		if (!show) this.editingAccount.value = null;
	};

	setEditingAccount = (account: AccountDTO | null) => {
		this.editingAccount.value = account ?? null;
	};

	setAddVaultDialog = (account: AccountDTO | null) => {
		if (account) {
			this.editingVault.value = {
				id: "",
				accountId: account.id,
				name: "",
				mountPath: [],
				password: "",
				createdAt: "",
				updatedAt: "",
			} as VaultDTO;
		} else {
			this.editingVault.value = null;
		}
	};

	setEditingVault = (vault: VaultDTO | null) => {
		this.editingVault.value = vault ?? null;
	};

	setCreateFolderDialog = (show: boolean) => {
		this.showCreateFolderDialog.value = show;
	};

	private refreshAccounts = async () => {
		this.accounts.value = await this.svcs.accountService.listAccounts();
	};

	deleteAccount = async (accountId: string) => {
		this.isLoading.value = true;
		await this.svcs.accountService.removeAccount(accountId);

		if (this.currentVault.value?.accountId === accountId) {
			this.currentVault.value = null;
		}

		await this.refreshAccounts();
		this.editingAccount.value = null;
		this.isLoading.value = false;
	};

	handleFileSelect = (fileId: string) => {
		this.handleFileToggle(fileId);
	};

	handleFileToggle = (fileId: string) => {
		const index = this.selectedFileKeys.value.indexOf(fileId);
		if (index > -1) {
			this.selectedFileKeys.value.splice(index, 1);
		} else {
			this.selectedFileKeys.value.push(fileId);
		}
	};

	handleFileDoubleClick = async (file: FileSystemObjectDTO) => {
		if (file.type === "folder") {
			await this.navigateToFolder(this.getFileName(file));
		} else {
			await this.downloadFiles([file]);
		}
	};

	isFileSelected = (fileId: string) => {
		return this.selectedFileKeys.value.includes(fileId);
	};

	clearSelection = () => {
		this.selectedFileKeys.value = [];
	};

	deleteSelectedFiles = async () => {
		if (this.selectedFileKeys.value.length === 0 || !this.files.value) return;
		const selectedFiles = this.files.value.filter((file) =>
			this.selectedFileKeys.value.includes(file.providedId),
		);
		await this.deleteFiles(selectedFiles);
		this.clearSelection();
	};

	downloadSelectedFiles = async () => {
		if (this.selectedFileKeys.value.length === 0 || !this.files.value) return;
		const selectedFiles = this.files.value.filter((file) =>
			this.selectedFileKeys.value.includes(file.providedId),
		);
		await this.downloadFiles(selectedFiles);
		this.clearSelection();
	};

	updateAccountName = async (accountData: Partial<AccountDTO>) => {
		await this.svcs.accountService.updateAccountName(
			accountData.id!,
			accountData.name!,
		);
		await this.refreshAccounts();
		this.editingAccount.value = null;
	};

	saveVault = async (vaultData: Partial<VaultDTO>) => {
		await this.svcs.accountService.saveVault(vaultData.accountId!, vaultData);
		await this.refreshAccounts();
		this.editingVault.value = null;
	};

	deleteVault = async (vaultId: string) => {
		const vault = this.editingVault.value;
		if (!vault) return;

		await this.svcs.accountService.deleteVault(vault.accountId, vaultId);

		if (this.currentVault.value?.id === vaultId) {
			this.currentVault.value = null;
		}

		await this.refreshAccounts();
		this.editingVault.value = null;
	};

	getAccountStatus = (accountDto: AccountDTO): AccountStatus => {
		if (!accountDto.oauthData) {
			return "disconnected";
		}

		const isExpired =
			accountDto.oauthData?.expiresAt <= new Date().toISOString();

		return isExpired ? "expired" : "connected";
	};

	getFileName = (fileDto: FileSystemObjectDTO): string => {
		return fileDto.path[fileDto.path.length - 1];
	};

	private handleTaskEvent = (eventType: TaskEventType, task: Task) => {
		this.tasks.value = this.svcs.taskQueueService.getAllTasks();

		const shortenedTarget = `${task.target.slice(0, 40)}${task.target.length > 40 ? "..." : ""}`;
		const taskTypeName = `${task.type.charAt(0).toUpperCase()}${task.type.slice(1)}`;

		if (eventType === "task-added" && task.status === "queued") {
			toast.info(`${taskTypeName} queued`, {
				id: `task-${task.id}`,
				description: shortenedTarget,
				closeButton: false,
				dismissible: false,
				duration: Number.POSITIVE_INFINITY,
				action: {
					label: "Cancel",
					onClick: () => this.svcs.taskQueueService.cancelTask(task.id),
				},
			});
		} else if (eventType === "task-status-changed") {
			if (task.status === "processing") {
				toast.loading(`${taskTypeName} in progress`, {
					id: `task-${task.id}`,
					description: shortenedTarget,
					closeButton: false,
					dismissible: false,
					duration: Number.POSITIVE_INFINITY,
					action: undefined,
				});
			} else if (task.status === "completed") {
				this.refreshFiles();
				toast.success(`${taskTypeName} completed`, {
					id: `task-${task.id}`,
					duration: 10,
					description: shortenedTarget,
					onDismiss: () => this.svcs.taskQueueService.deleteTask(task.id),
					action: undefined,
				});
			} else if (task.status === "failed") {
				toast.error(`${taskTypeName} failed`, {
					id: `task-${task.id}`,
					description: shortenedTarget,
					closeButton: true,
					dismissible: true,
					duration: Number.POSITIVE_INFINITY,
					onDismiss: () => this.svcs.taskQueueService.deleteTask(task.id),
					action: {
						label: "Retry",
						onClick: () => this.svcs.taskQueueService.retryTask(task.id),
					},
				});
			} else if (task.status === "cancelled") {
				toast.error(`${taskTypeName} cancelled`, {
					id: `task-${task.id}`,
					duration: 10,
					closeButton: true,
					dismissible: true,
					description: shortenedTarget,
					onDismiss: () => this.svcs.taskQueueService.deleteTask(task.id),
					action: {
						label: "Retry",
						onClick: () => this.svcs.taskQueueService.retryTask(task.id),
					},
				});
			}
		}
	};

	initialize = async () => {
		await this.svcs.init();
		this.svcs.taskQueueService.addEventListener(this.handleTaskEvent);
		this.isLoading.value = true;
		await this.refreshAccounts();
		this.isLoading.value = false;
	};
}

let appControllerInstance: AppController | null = null;

export function useAppController(): AppController {
	if (!appControllerInstance) {
		appControllerInstance = new AppController();
	}
	return appControllerInstance;
}
