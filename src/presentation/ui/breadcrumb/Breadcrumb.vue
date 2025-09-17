<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/presentation/ui/utils";
import { type BreadcrumbVariants, breadcrumbVariants } from ".";

interface Props {
	class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {});
</script>

<template>
  <nav :class="cn(breadcrumbVariants(), props.class)" aria-label="breadcrumb">
    <slot />
  </nav>
</template>
