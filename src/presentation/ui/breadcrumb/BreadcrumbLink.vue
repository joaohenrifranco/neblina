<script setup lang="ts">
import { Primitive } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "@/presentation/ui/utils";
import { type BreadcrumbLinkVariants, breadcrumbLinkVariants } from ".";

interface Props {
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
    :class="cn(breadcrumbLinkVariants(), props.class)"
  >
    <slot />
  </Primitive>
</template>
