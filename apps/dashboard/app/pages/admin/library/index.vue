<template>
  <UPage>
    <UPageHeader
      title="Manga library"
      description="Search and filter titles in your local collection."
      :links="headerLinks"
    />

    <UPageBody class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search by title..."
          class="flex-1 sm:max-w-sm"
          @update:model-value="debouncedRefresh"
        />
        <USelect
          v-model="statusFilter"
          :items="statusOptions"
          placeholder="All statuses"
          class="w-full sm:w-44"
          @update:model-value="() => refresh()"
        />
      </div>

      <div
        v-if="pending"
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
      >
        <USkeleton v-for="i in 10" :key="i" class="aspect-[3/4] rounded-lg" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        title="Could not load library"
        description="Your manga list failed to load."
        :actions="[{ label: 'Retry', color: 'error', variant: 'outline', onClick: () => refresh() }]"
      />

      <UEmpty
        v-else-if="mangaList.length === 0"
        icon="i-lucide-book-open"
        title="No manga yet"
        description="Import a series from MangaDex or upload files to start building your library."
        variant="subtle"
        :actions="[
          { label: 'Import from MangaDex', icon: 'i-lucide-download', to: '/admin/mangadex' },
          { label: 'Upload manga', icon: 'i-lucide-upload', color: 'neutral', variant: 'outline', to: '/admin/upload' }
        ]"
      />

      <div
        v-else
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
      >
        <AdminMangaAdminCard
          v-for="manga in mangaList"
          :key="manga.id"
          :manga="manga"
        />
      </div>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'
import type { MangaListItem } from '@skald-scan/shared'

definePageMeta({ layout: 'admin' })

useHead({ title: 'Library — Skald Scan Dashboard' })

const headerLinks: ButtonProps[] = [
  { label: 'Upload', icon: 'i-lucide-upload', to: '/admin/upload', color: 'neutral', variant: 'outline' },
  { label: 'Import', icon: 'i-lucide-plus', to: '/admin/mangadex' }
]

const search = ref('')
const statusFilter = ref<string | undefined>(undefined)

const statusOptions = [
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Hiatus', value: 'hiatus' },
  { label: 'Cancelled', value: 'cancelled' }
]

const { data: response, pending, error, refresh } = await useFetch<{ manga: MangaListItem[] }>('/api/manga', {
  query: computed(() => ({
    q: search.value || undefined,
    status: statusFilter.value || undefined
  }))
})

const mangaList = computed(() => response.value?.manga ?? [])

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedRefresh() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => refresh(), 300)
}
</script>
