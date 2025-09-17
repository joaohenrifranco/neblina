<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
</script>

<template>
  <div class="flex flex-col items-center justify-center h-screen gap-4">
    <Loader2 class="w-10 h-10 animate-spin" />
    <span class="text-muted-foreground">Loading Google APIs...</span>
  </div>
</template>
