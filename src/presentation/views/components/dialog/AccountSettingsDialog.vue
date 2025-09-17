<template>
<Dialog :open="open" @update:open="$emit('update:open', $event)">
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Account Settings</DialogTitle>
			<DialogDescription>
				Manage settings for {{ account?.name || 'this account' }}.
			</DialogDescription>
		</DialogHeader>

		<div v-if="account" class="space-y-4">
			<div class="space-y-3">
				<div>
					<label class="text-sm font-medium">Account Name</label>
					<Input v-model="form.name" class="mt-1" />
				</div>

				<div class="text-sm space-y-1">
					<div class="flex justify-between py-2">
						<span class="text-muted-foreground">Provider:</span>
						<span class="capitalize">{{ account.providerId }}</span>
					</div>
					<div class="flex justify-between py-2">
						<span class="text-muted-foreground">Email:</span>
						<span>{{ account.oauthData?.email || 'Not available' }}</span>
					</div>
					<div class="flex justify-between py-2">
						<span class="text-muted-foreground">Status:</span>
						<span :class="{
							'text-green-500': accountStatus === 'connected',
							'text-destructive': accountStatus !== 'connected'
						}">
							{{ statusText }}
						</span>
					</div>
				</div>
			</div>
		</div>

		<div class="flex justify-between">
			<div>
				<Button variant="destructive" @click="handleDelete" :disabled="loading">
					<Trash2 class="w-4 h-4 mr-2" />
					Remove
				</Button>
			</div>
			<div class="flex gap-2">
				<Button v-if="accountStatus === 'expired'" variant="default" @click="handleReauth" :disabled="loading">
					<LogOut class="w-4 h-4 mr-2" />
					Re-authenticate
				</Button>
				<Button variant="outline" @click="$emit('update:open', false)">Close</Button>
				<Button @click="handleSave" :disabled="loading || !hasNameChanged">
					Save
				</Button>
			</div>
		</div>
	</DialogContent>
</Dialog>
</template>

<script setup lang="ts">
import { LogOut, Trash2 } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import type { AccountDTO } from "@/domain/entities/Account";
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
	account: AccountDTO | null;
	loading?: boolean;
}

interface Emits {
	(e: "update:open", value: boolean): void;
	(e: "save", account: Partial<AccountDTO>): void;
	(e: "reauth", accountId: string): void;
	(e: "delete", accountId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = ref({
	name: "",
});

const accountStatus = computed(() => {
	if (!props.account?.oauthData) return "disconnected";
	const expiresAt = new Date(props.account.oauthData.expiresAt);
	return expiresAt > new Date() ? "connected" : "expired";
});

const getTimeUntilExpiry = () => {
	if (!props.account?.oauthData) return null;
	const expiresAt = new Date(props.account.oauthData.expiresAt);
	const now = new Date();
	const diffMs = expiresAt.getTime() - now.getTime();
	if (diffMs <= 0) return null;

	const minutes = Math.floor(diffMs / (1000 * 60));
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d`;
	if (hours > 0) return `${hours}h`;
	return `${minutes}m`;
};

const statusText = computed(() => {
	switch (accountStatus.value) {
		case "connected": {
			const timeUntilExpiry = getTimeUntilExpiry();
			return `Connected${timeUntilExpiry ? ` (expires in ${timeUntilExpiry})` : ""}`;
		}
		case "expired":
			return "Auth Expired";
		default:
			return "Disconnected";
	}
});

const hasNameChanged = computed(() => {
	return form.value.name !== props.account?.name;
});

watch(
	() => props.account,
	(newAccount) => {
		if (newAccount) {
			form.value.name = newAccount.name;
		}
	},
	{ immediate: true },
);

watch(
	() => props.open,
	(isOpen) => {
		if (!isOpen || !props.account) return;
		form.value.name = props.account.name;
	},
);

const handleSave = () => {
	if (!props.account || !form.value.name.trim()) return;
	emit("save", {
		id: props.account.id,
		name: form.value.name.trim(),
	});
};

const handleReauth = () => {
	if (!props.account) return;
	emit("reauth", props.account.id);
};

const handleDelete = () => {
	if (!props.account) return;
	emit("delete", props.account.id);
};
</script>