<script setup>
import { computed, onMounted, ref } from "vue";
import { useAppController } from "@/presentation/composables/useAppController";
import { Toaster } from "@/presentation/ui/sonner";
import LoadingView from "@/presentation/views/LoadingView.vue";
import MainView from "@/presentation/views/MainView.vue";
import "vue-sonner/style.css";

const controller = useAppController();
const loading = ref(true);

const isModalActive = computed(() => {
	return (
		controller.showAddAccountDialog.value ||
		controller.showCreateFolderDialog.value
	);
});

onMounted(async () => {
	await controller.initialize();
	loading.value = false;
});
</script>

<template>
<div class="relative">
	<div :class="{ 'blur-sm transition-all duration-200 ease-in-out': isModalActive }">
		<LoadingView v-if="loading" />
		<MainView v-else />
	</div>
	<Toaster rich-colors position="bottom-right" :visible-toasts="5" />
</div>
</template>
