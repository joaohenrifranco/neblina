<script setup lang="ts">
import { Primitive } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/presentation/ui/utils";
import { type ButtonVariants, buttonVariants } from ".";

interface Props {
	variant?: ButtonVariants["variant"];
	size?: ButtonVariants["size"];
	as?: string;
	class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<Props>(), {
	as: "button",
});
</script>

<template>
  <Primitive
    :as="props.as"
    :class="cn(buttonVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <slot />
  </Primitive>
</template>