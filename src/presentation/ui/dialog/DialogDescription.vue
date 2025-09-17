<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { DialogDescriptionProps } from "reka-ui";
import { DialogDescription, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/presentation/ui/utils";

const props = defineProps<
	DialogDescriptionProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <DialogDescription
    v-bind="forwardedProps"
    :class="cn('text-sm text-muted-foreground', props.class)"
  >
    <slot />
  </DialogDescription>
</template>
