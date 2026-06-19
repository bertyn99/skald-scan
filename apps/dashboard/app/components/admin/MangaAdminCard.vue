<template>
  <NuxtLink :to="`/admin/library/${manga.id}`" class="group block">
    <UCard
      variant="subtle"
      :ui="{
        root: 'overflow-hidden transition-shadow hover:shadow-md hover:ring-primary/30',
        body: 'p-0 sm:p-0'
      }"
    >
      <div class="aspect-[3/4] bg-muted relative">
        <img
          v-if="displayCoverUrl"
          :src="displayCoverUrl"
          :alt="manga.title"
          class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          loading="lazy"
        >
        <div v-else class="w-full h-full flex items-center justify-center">
          <UIcon name="i-lucide-book-open" class="size-8 text-muted" />
        </div>
        <UBadge
          :color="statusColor"
          variant="subtle"
          size="xs"
          class="absolute top-2 right-2"
        >
          {{ manga.status }}
        </UBadge>
      </div>

      <div class="p-3 space-y-1">
        <h3 class="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {{ manga.title }}
        </h3>
        <p class="text-xs text-muted tabular-nums">
          {{ manga.chapterCount }} chapter{{ manga.chapterCount !== 1 ? 's' : '' }}
        </p>
      </div>
    </UCard>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { MangaListItem } from '@skald-scan/shared'

const props = defineProps<{
  manga: MangaListItem
}>()

const displayCoverUrl = computed(() => mangaCoverUrl(props.manga.id, props.manga.coverUrl))

const statusColor = computed(() => {
  switch (props.manga.status) {
    case 'completed': return 'success'
    case 'ongoing': return 'primary'
    case 'hiatus': return 'warning'
    case 'cancelled': return 'error'
    default: return 'neutral'
  }
})
</script>
