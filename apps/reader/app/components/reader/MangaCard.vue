<template>
  <NuxtLink :to="`/manga/${manga.id}`" class="group block">
    <div class="rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 transition-colors">
      <div class="aspect-[3/4] bg-muted relative">
        <img
          v-if="manga.coverUrl"
          :src="manga.coverUrl"
          :alt="manga.title"
          class="w-full h-full object-cover"
          loading="lazy"
        >
        <div v-else class="w-full h-full flex items-center justify-center">
          <UIcon name="i-lucide-book-open" class="w-8 h-8 text-muted-foreground" />
        </div>

        <!-- Progress overlay -->
        <div
          v-if="manga.lastReadChapter !== undefined"
          class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2"
        >
          <p class="text-xs text-white/90">
            Ch. {{ manga.lastReadChapter }}
          </p>
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

      <div class="p-2 space-y-0.5">
        <h3 class="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {{ manga.title }}
        </h3>
        <p class="text-xs text-muted-foreground">
          {{ manga.chapterCount }} chapter{{ manga.chapterCount !== 1 ? 's' : '' }}
        </p>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { MangaListItem } from '@skald-scan/shared'

const props = defineProps<{
  manga: MangaListItem
}>()

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
