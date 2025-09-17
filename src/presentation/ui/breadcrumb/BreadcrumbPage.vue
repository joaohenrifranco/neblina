<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/presentation/ui/utils";
import { type BreadcrumbPageVariants, breadcrumbPageVariants } from ".";

interface Props {
	class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {});
</script>

<template>
  <span 
    role="link"
    aria-disabled="true"
    aria-current="page"
    :class="cn(breadcrumbPageVariants(), props.class)"
  >
    <slot />
  </span>
</template>
