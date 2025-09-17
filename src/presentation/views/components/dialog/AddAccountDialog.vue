<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add Cloud Account</DialogTitle>
        <DialogDescription>
          Connect your cloud storage account to create encrypted vaults.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium">Account Type</label>
          <select
            v-model="form.type"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option v-for="provider in availableProviders" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
        </div>

        <div class="border rounded-lg p-3 bg-muted/30">
          <p class="text-xs text-muted-foreground">
            <strong>Note:</strong> Google will show an "unverified app" warning during authentication. This is normal for open source projects and safe to proceed with.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
        <Button @click="handleSave" :disabled="loading">
          Authenticate with {{ selectedProviderName }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ProviderId } from "@/domain/entities/Account";
import { Button } from "@/presentation/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/presentation/ui/dialog";

interface Provider {
	id: ProviderId;
	name: string;
}

interface Props {
	open: boolean;
	availableProviders: Provider[];
	loading?: boolean;
}

interface Emits {
	(e: "update:open", value: boolean): void;
	(e: "save", providerId: ProviderId): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = ref({
	type: props.availableProviders[0]?.id || ("gdrive" as ProviderId),
});

const selectedProviderName = computed(() => {
	return (
		props.availableProviders.find((p) => p.id === form.value.type)?.name || ""
	);
});

watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			form.value.type =
				props.availableProviders[0]?.id || ("gdrive" as ProviderId);
		}
	},
);

const handleSave = () => {
	emit("save", form.value.type);
};
</script>