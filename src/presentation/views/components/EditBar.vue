<script setup lang="ts">
import { Download, FolderPlus, Plus, Trash2 } from "lucide-vue-next";
import { Button } from "@/presentation/ui/button";

defineProps<{
	selectedKeys: string[];
}>();

const emit = defineEmits<{
	deleteFiles: [];
	downloadFiles: [];
	uploadFiles: [];
	createFolder: [];
}>();

const handleDeleteClick = () => {
	emit("deleteFiles");
};

const handleDownloadClick = () => {
	emit("downloadFiles");
};

const handleUploadClick = () => {
	emit("uploadFiles");
};

const handleCreateFolderClick = () => {
	emit("createFolder");
};
</script>

<template>
<div class="flex items-center gap-4">
  <Button :disabled="selectedKeys.length === 0" @click="handleDownloadClick" size="sm" variant="ghost" class="gap-1">
    <Download class="w-4 h-4" />
    <span class="hidden sm:inline">Download ({{ selectedKeys.length }})</span>
  </Button>

  <Button :disabled="selectedKeys.length === 0" @click="handleDeleteClick" size="sm" variant="ghost" class="gap-1">
    <Trash2 class="w-4 h-4" />
    <span class="hidden sm:inline">Delete ({{ selectedKeys.length }})</span>
  </Button>

  <div class="border-l h-6" />

  <Button @click="handleCreateFolderClick" size="sm" variant="ghost" class="gap-1">
    <FolderPlus class="w-4 h-4" />
    <span class="hidden sm:inline">New Folder</span>
  </Button>


  <Button @click="handleUploadClick" size="sm" variant="default" class="gap-1">
    <Plus class="w-4 h-4" />
    <span class="hidden sm:inline">Upload</span>
  </Button>

</div>
</template>
