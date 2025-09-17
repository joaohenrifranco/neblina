<script setup lang="ts">
import { Toaster as Sonner } from "vue-sonner";

interface ToasterProps {
	theme?: "light" | "dark" | "system";
	class?: string;
	toastOptions?: {
		style?: Record<string, string>;
		className?: string;
	};
	richColors?: boolean;
	expand?: boolean;
	visibleToasts?: number;
	position?:
		| "top-left"
		| "top-right"
		| "bottom-left"
		| "bottom-right"
		| "top-center"
		| "bottom-center";
	closeButton?: boolean;
	offset?: string | number;
	dir?: "rtl" | "ltr" | "auto";
}

const props = withDefaults(defineProps<ToasterProps>(), {
	theme: "dark",
	richColors: false,
	expand: false,
	visibleToasts: 4,
	position: "bottom-right",
	closeButton: false,
	offset: 32,
	dir: "auto",
});
</script>

<template>
<Sonner :theme="props.theme" :class="props.class" :toast-options="props.toastOptions" :rich-colors="props.richColors"
	:expand="props.expand" :visible-toasts="props.visibleToasts" :position="props.position"
	:close-button="props.closeButton" :offset="props.offset" :dir="props.dir" />
</template>
