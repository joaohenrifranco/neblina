<template>
<Dialog :open="open" @update:open="$emit('update:open', $event)">
	<DialogContent>
		<DialogHeader>
			<DialogTitle>{{ vault?.id ? 'Edit Vault' : 'Create New Vault' }}</DialogTitle>
			<DialogDescription>
				{{ vault?.id ? 'Modify vault settings' : 'Set up a new encrypted vault for file storage' }}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4">
			<div>
				<label class="text-sm font-medium">Vault Name</label>
				<Input v-model="form.name" placeholder="my-encrypted-vault" class="mt-1" />
			</div>
			<div>
				<label class="text-sm font-medium">Vault Folder</label>
				<div class="mt-1 flex items-center space-x-2">
					<Input
						v-model="form.mountPath"
						placeholder="path/to/folder"
						readonly
						class="flex-1 bg-muted/50"
					/>
					<Button
						variant="outline"
						size="sm"
						@click="openFolderPicker"
						:disabled="loading"
					>
						<FolderSearch class="w-4 h-4" />
					</Button>
				</div>
			</div>
			<div>
				<label class="text-sm font-medium">Encryption Password</label>
				<Input v-model="form.password" type="password"
					:placeholder="vault?.id ? 'Leave empty to keep current password' : 'Strong encryption password'"
					class="mt-1" />
			</div>
		</div>

		<div class="flex justify-between">
			<div>
				<Button v-if="vault?.id" variant="destructive" @click="handleDelete" :disabled="loading">
					<Trash2 class="w-4 h-4 mr-2" />
					Remove
				</Button>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
				<Button @click="handleSave" :disabled="loading || !saveEnabled">
					{{ vault?.id ? 'Save Changes' : 'Create Vault' }}
				</Button>
			</div>
		</div>
	</DialogContent>
</Dialog>
</template>

<script setup lang="ts">
import { FolderSearch, Trash2 } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import type { VaultDTO } from "@/domain/entities/Vault";
import { Button } from "@/presentation/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/presentation/ui/dialog";
import { Input } from "@/presentation/ui/input";

interface Props {
	open: boolean;
	vault: VaultDTO;
	loading?: boolean;
}

interface Emits {
	(e: "update:open", value: boolean): void;
	(e: "save", vault: Partial<VaultDTO>): void;
	(e: "delete", vaultId: string): void;
	(e: "openFolderPicker", accountId: string): Promise<string[] | null>;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = ref({
	name: "",
	mountPath: "",
	password: "",
});

const saveEnabled = computed(() => {
	if (!props.vault?.id) {
		return form.value.name && form.value.password;
	}

	const originalMountPath = props.vault.mountPath.join("/");
	const originalPassword = props.vault.password || "";

	return (
		(form.value.name !== props.vault.name ||
			form.value.mountPath !== originalMountPath ||
			form.value.password !== originalPassword) &&
		form.value.name
	);
});

watch(
	() => props.vault,
	(newVault) => {
		form.value.name = newVault.name;
		form.value.mountPath = newVault.mountPath.join("/");
		form.value.password = newVault.password;
	},
	{ immediate: true },
);

watch(
	() => props.open,
	(isOpen) => {
		if (!isOpen && !props.vault) {
			form.value.name = "";
			form.value.mountPath = "";
			form.value.password = "";
		}
	},
);

const handleSave = () => {
	const mountPathArray = form.value.mountPath
		.split("/")
		.filter((p) => p.length > 0);
	const vaultData: Partial<VaultDTO> = {
		name: form.value.name,
		mountPath: mountPathArray,
		password: form.value.password,
		accountId: props.vault.accountId,
		id: props.vault.id,
	};

	emit("save", vaultData);
};

const handleDelete = () => {
	if (props.vault?.id) {
		emit("delete", props.vault.id);
	}
};

const openFolderPicker = async () => {
	try {
		const selectedPath = await emit("openFolderPicker", props.vault.accountId);
		if (selectedPath) {
			form.value.mountPath = selectedPath.join("/");
		}
	} catch (error) {
		console.error("Failed to open folder picker:", error);
	}
};
</script>