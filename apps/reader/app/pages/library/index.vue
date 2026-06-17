<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Library</h1>
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search manga..."
        class="max-w-xs"
        @update:model-value="debouncedRefresh"
      />
    </div>

    <div v-if="pending" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <USkeleton v-for="i in 12" :key="i" class="aspect-[3/4] rounded-lg" />
    </div>

    <div v-else-if="error" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
      <p>Failed to load library.</p>
      <UButton variant="outline" class="mt-4" @click="() => refresh()">Retry</UButton>
    </div>

    <div v-else-if="mangaList.length === 0" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-book-open" class="w-12 h-12 mx-auto mb-4" />
      <p v-if="search">No results for "{{ search }}".</p>
      <p v-else>Your library is empty. Search MangaDex to add some manga.</p>
      <UButton v-if="!search" to="/search" class="mt-4" icon="i-lucide-search">
        Search MangaDex
      </UButton>
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

useHead({ title: 'Library — Skald Scan' })

const search = ref('')

const { data: response, pending, error, refresh } = await useFetch<{ manga: MangaListItem[] }>('/api/proxy/manga', {
  query: computed(() => ({
    q: search.value || undefined,
  })),
})

const mangaList = computed(() => response.value?.manga ?? [])

let timer: ReturnType<typeof setTimeout> | null = null
function debouncedRefresh() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => refresh(), 300)
}
</script>
