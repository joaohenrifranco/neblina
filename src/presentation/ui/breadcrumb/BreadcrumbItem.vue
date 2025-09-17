<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/presentation/ui/utils";
import { type BreadcrumbItemVariants, breadcrumbItemVariants } from ".";

interface Props {
	class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {});
</script>

<template>
  <li :class="cn(breadcrumbItemVariants(), props.class)">
    <slot />
  </li>
</template>
