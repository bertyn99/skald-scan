<template>
  <span
    v-if="cached"
    class="inline-flex items-center gap-1 text-xs text-green-400"
  >
    <UIcon name="i-lucide-wifi-off" class="size-3" />
    Available offline
  </span>
</template>

<script setup lang="ts">
defineProps<{
  cached: boolean
}>()
</script>
