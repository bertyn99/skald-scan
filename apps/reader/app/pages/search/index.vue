<template>
  <UContainer class="py-8 space-y-6">
    <h1 class="text-2xl font-bold">Discover manga</h1>

    <form class="flex gap-2" @submit.prevent="doSearch">
      <UInput
        v-model="query"
        icon="i-lucide-search"
        placeholder="Search the Skald catalog..."
        class="flex-1 max-w-lg"
        size="lg"
      />
      <UButton type="submit" color="primary" :loading="searching" :disabled="!query.trim()">
        Search
      </UButton>
    </form>

    <div v-if="!hasSearched" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-search" class="w-12 h-12 mx-auto mb-4" />
      <p>Search titles hosted on this Skald instance.</p>
    </div>

    <div v-else-if="searching" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <USkeleton v-for="i in 10" :key="i" class="aspect-[3/4] rounded-lg" />
    </div>

    <div v-else-if="error" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
      <p>Search failed. Please try again.</p>
    </div>

    <div v-else-if="results.length === 0" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-search-x" class="w-12 h-12 mx-auto mb-4" />
      <p>No results found for "{{ lastQuery }}".</p>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <ReaderMangaCard
        v-for="result in results"
        :key="result.id"
        :manga="result"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { MangaListItem } from '@skald-scan/shared'

useHead({ title: 'Discover — Skald Scan' })

const { language, init } = useReaderLanguage()
await init()

const query = ref('')
const lastQuery = ref('')
const hasSearched = ref(false)
const searching = ref(false)
const error = ref(false)
const results = ref<MangaListItem[]>([])

async function doSearch() {
  const q = query.value.trim()
  if (!q) return

  lastQuery.value = q
  searching.value = true
  error.value = false
  hasSearched.value = true

  try {
    const response = await $fetch<{ manga: MangaListItem[] }>(dashboardApi('/manga'), {
      params: { q, lang: language.value }
    })
    results.value = response.manga
  } catch {
    error.value = true
    results.value = []
  } finally {
    searching.value = false
  }
}
</script>
