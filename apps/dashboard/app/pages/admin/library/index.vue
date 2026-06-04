<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Manga Library</h1>
      <UButton to="/admin/mangadex" icon="i-lucide-plus" size="sm">
        Import from MangaDex
      </UButton>
    </div>

    <div class="flex items-center gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search manga..."
        class="flex-1 max-w-sm"
        @update:model-value="debouncedRefresh"
      />
      <USelect
        v-model="statusFilter"
        :items="statusOptions"
        placeholder="All statuses"
        class="w-44"
        @update:model-value="refresh"
      />
    </div>

    <div v-if="pending" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <USkeleton v-for="i in 10" :key="i" class="h-64 rounded-lg" />
    </div>

    <div v-else-if="error" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
      <p>Failed to load manga library.</p>
      <UButton variant="outline" class="mt-4" @click="refresh">Retry</UButton>
    </div>

    <div v-else-if="mangaList.length === 0" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-book-open" class="w-12 h-12 mx-auto mb-4" />
      <p>No manga found. Import some from MangaDex to get started.</p>
      <UButton to="/admin/mangadex" class="mt-4" icon="i-lucide-download">
        Import from MangaDex
      </UButton>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <AdminMangaAdminCard
        v-for="manga in mangaList"
        :key="manga.id"
        :manga="manga"
      />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
import type { MangaListItem } from '@skald-scan/shared'

definePageMeta({ layout: 'admin' })

useHead({ title: 'Library — Skald Scan Dashboard' })

const search = ref('')
const statusFilter = ref<string | null>(null)

const statusOptions = [
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Hiatus', value: 'hiatus' },
  { label: 'Cancelled', value: 'cancelled' },
]

const { data: response, pending, error, refresh } = await useFetch<{ manga: MangaListItem[] }>('/api/manga', {
  query: computed(() => ({
    q: search.value || undefined,
    status: statusFilter.value || undefined,
  })),
})

const mangaList = computed(() => response.value?.manga ?? [])

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedRefresh() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => refresh(), 300)
}
</script>
