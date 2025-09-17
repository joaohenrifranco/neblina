<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogDescription>
          Enter a name for the new folder.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div>
          <label class="text-sm font-medium">Folder Name</label>
          <Input 
            v-model="form.name" 
            placeholder="New folder"
            @keyup.enter="handleSave"
            class="mt-1"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">Cancel</Button>
        <Button 
          @click="handleSave" 
          :disabled="loading || !form.name.trim()"
        >
          Create Folder
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
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
	loading?: boolean;
}

interface Emits {
	(e: "update:open", value: boolean): void;
	(e: "save", folderName: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = ref({
	name: "",
});

watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			form.value.name = "";
		}
	},
);

const handleSave = () => {
	const folderName = form.value.name.trim();
	if (!folderName) return;
	emit("save", folderName);
};
</script>