<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import type { HTMLAttributes } from "vue";
import { cn } from "@/presentation/ui/utils";
import {
	type BreadcrumbSeparatorVariants,
	breadcrumbSeparatorVariants,
} from ".";

interface Props {
	class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {});
</script>

<template>
  <li 
    role="presentation"
    aria-hidden="true"
    :class="cn(breadcrumbSeparatorVariants(), props.class)"
  >
    <slot>
      <ChevronRight />
    </slot>
  </li>
</template>
