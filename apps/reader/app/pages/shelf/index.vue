<template>
  <UContainer class="py-8 space-y-6">
    <h1 class="text-2xl font-bold">Continue Reading</h1>

    <div v-if="pending" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <USkeleton v-for="i in 6" :key="i" class="aspect-[3/4] rounded-lg" />
    </div>

    <div v-else-if="error" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
      <p>Failed to load shelf.</p>
      <UButton variant="outline" class="mt-4" @click="refresh">Retry</UButton>
    </div>

    <div v-else-if="mangaList.length === 0" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-bookmark" class="w-12 h-12 mx-auto mb-4" />
      <p>No reading history yet. Start reading to build your shelf.</p>
      <UButton to="/library" class="mt-4" icon="i-lucide-library">Browse Library</UButton>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <ReaderMangaCard
        v-for="manga in mangaList"
        :key="manga.id"
        :manga="manga"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { MangaListItem } from '@skald-scan/shared'

useHead({ title: 'Shelf — Skald Scan' })

const { data: response, pending, error, refresh } = await useFetch<{ manga: MangaListItem[] }>('/api/proxy/manga', {
  query: { reading: 'true' },
})

const mangaList = computed(() => response.value?.manga ?? [])
</script>
