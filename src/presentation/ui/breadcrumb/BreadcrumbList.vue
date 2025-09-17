<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/presentation/ui/utils";

interface Props {
	class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {});
</script>

<template>
  <ol :class="cn('flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5', props.class)">
    <slot />
  </ol>
</template>
