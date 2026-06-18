<template>
  <UCard variant="subtle" :ui="{ body: 'p-0 sm:p-0' }">
    <div class="divide-y divide-default">
      <div class="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div>
          <h2 class="text-base font-semibold text-highlighted">Chapters</h2>
          <p class="text-sm text-muted mt-0.5">
            <template v-if="stats.total > 0">
              {{ stats.imported }} of {{ stats.total }} chapters imported
            </template>
            <template v-else-if="isActive">
              Discovering chapters from MangaDex…
            </template>
            <template v-else>
              No chapters in this title yet
            </template>
          </p>
        </div>
        <AdminSyncStatusBadge v-if="showSyncBadge" :status="syncBadgeStatus" />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-default">
        <div
          v-for="item in statItems"
          :key="item.label"
          class="flex items-center gap-3 px-5 py-4"
        >
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-md"
            :class="item.iconClass"
          >
            <UIcon :name="item.icon" class="size-4" :class="item.iconColorClass" />
          </div>
          <div class="min-w-0">
            <p class="text-2xl font-semibold text-highlighted tabular-nums leading-none">
              {{ item.value }}
            </p>
            <p class="text-sm text-muted mt-1">{{ item.label }}</p>
          </div>
        </div>
      </div>

      <div v-if="stats.total > 0" class="space-y-2 px-5 py-4">
        <div class="flex items-center justify-between gap-3 text-xs text-muted">
          <span>Import progress</span>
          <span class="tabular-nums">{{ progressPercent }}%</span>
        </div>
        <UProgress :model-value="progressPercent" :max="100" size="sm" />
        <p v-if="stats.importing > 0" class="text-xs text-muted">
          <UIcon name="i-lucide-loader-2" class="size-3 inline mr-1 animate-spin align-text-bottom" />
          {{ stats.importing }} chapter{{ stats.importing === 1 ? '' : 's' }} still importing
        </p>
      </div>

      <div v-else-if="totalUnknown" class="px-5 py-4">
        <UProgress size="sm" animation="carousel" />
      </div>

      <UAlert
        v-if="sync?.status === 'error' && sync.lastError"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        title="Chapter sync failed"
        :description="sync.lastError"
        class="rounded-none border-0"
      />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { ChapterImportStats, MangaSyncInfo } from '@skald-scan/shared'

const props = defineProps<{
  stats: ChapterImportStats
  sync: MangaSyncInfo | null
}>()

const isActive = computed(() =>
  props.stats.importing > 0 || props.sync?.status === 'syncing'
)

const totalUnknown = computed(() =>
  props.stats.total === 0 && props.sync?.status === 'syncing'
)

const progressPercent = computed(() => {
  if (props.stats.total <= 0) return 0
  return Math.min(100, Math.round((props.stats.imported / props.stats.total) * 100))
})

const statItems = computed(() => [
  {
    label: 'Total in series',
    value: totalUnknown.value ? '—' : props.stats.total,
    icon: 'i-lucide-library',
    iconClass: 'bg-elevated',
    iconColorClass: 'text-toned',
  },
  {
    label: 'Imported',
    value: props.stats.imported,
    icon: 'i-lucide-check-circle',
    iconClass: 'bg-success/10',
    iconColorClass: 'text-success',
  },
  {
    label: 'Importing',
    value: totalUnknown.value && props.stats.importing === 0 ? '…' : props.stats.importing,
    icon: 'i-lucide-download',
    iconClass: 'bg-primary/10',
    iconColorClass: 'text-primary',
  },
])

const showSyncBadge = computed(() =>
  isActive.value || props.sync?.status === 'error'
)

const syncBadgeStatus = computed(() => {
  if (props.sync?.status === 'error') return 'failed' as const
  if (isActive.value) return 'processing' as const
  if (props.stats.total > 0 && props.stats.imported >= props.stats.total) return 'completed' as const
  return 'idle' as const
})
</script>
