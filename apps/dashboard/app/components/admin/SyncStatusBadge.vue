<template>
  <UBadge :color="color" variant="subtle" size="sm">
    <UIcon v-if="icon" :name="icon" class="w-3 h-3 mr-1" />
    {{ label }}
  </UBadge>
</template>

<script setup lang="ts">
const props = defineProps<{
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'idle'
}>()

const color = computed(() => {
  switch (props.status) {
    case 'completed': return 'success'
    case 'processing': return 'primary'
    case 'queued': return 'warning'
    case 'failed': return 'error'
    default: return 'neutral'
  }
})

const icon = computed(() => {
  switch (props.status) {
    case 'completed': return 'i-lucide-check-circle'
    case 'processing': return 'i-lucide-loader-2'
    case 'queued': return 'i-lucide-clock'
    case 'failed': return 'i-lucide-x-circle'
    default: return undefined
  }
})

const label = computed(() => {
  switch (props.status) {
    case 'completed': return 'Synced'
    case 'processing': return 'Syncing'
    case 'queued': return 'Queued'
    case 'failed': return 'Failed'
    default: return 'Not synced'
  }
})
</script>
