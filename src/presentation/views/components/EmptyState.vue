<script setup lang="ts">
interface Props {
	title: string;
	description?: string;
}

defineProps<Props>();
</script>

<template>
<Card class="max-w-md mx-auto mt-20">
  <CardHeader class="text-center">
    <CardTitle>{{ title }}</CardTitle>
    <CardDescription v-if="description">{{ description }}</CardDescription>
  </CardHeader>
  <CardContent class="text-center" v-if="$slots.default">
    <slot />
  </CardContent>
</Card>
</template>

<script lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/presentation/ui/card";

</script>