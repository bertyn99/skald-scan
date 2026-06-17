<template>
  <UPage>
    <UPageHeader
      title="Import from MangaDex"
      description="Search MangaDex and queue titles for import into your library."
      :links="[{ label: 'View library', icon: 'i-lucide-library', to: '/admin/library', color: 'neutral', variant: 'outline' }]"
    />

    <UPageBody class="space-y-6">
      <form class="flex flex-col sm:flex-row gap-3" @submit.prevent="doSearch">
        <UInput
          v-model="query"
          icon="i-lucide-search"
          placeholder="Search by title..."
          class="flex-1 sm:max-w-lg"
        />
        <UButton type="submit" color="primary" :loading="searching" :disabled="!query.trim()">
          Search
        </UButton>
      </form>

      <UAlert
        v-if="importStatus"
        :color="importStatus.error ? 'error' : 'success'"
        variant="subtle"
        :icon="importStatus.error ? 'i-lucide-alert-circle' : 'i-lucide-check-circle'"
        :title="importStatus.title"
        :description="importStatus.message"
        :actions="importStatus.error ? undefined : [{ label: 'Open library', to: '/admin/library', color: 'neutral', variant: 'outline' }]"
      />

      <UEmpty
        v-if="!hasSearched"
        icon="i-lucide-download"
        title="Search MangaDex"
        description="Find a series by title, then import it to sync metadata and chapters."
        variant="subtle"
      />

      <div
        v-else-if="searching"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <USkeleton v-for="i in 6" :key="i" class="h-32 rounded-lg" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        title="Search failed"
        description="Could not reach MangaDex. Check your connection and try again."
        :actions="[{ label: 'Retry', color: 'error', variant: 'outline', onClick: () => doSearch() }]"
      />

      <UEmpty
        v-else-if="results.length === 0"
        icon="i-lucide-search-x"
        title="No results"
        :description="`No manga found for “${lastQuery}”.`"
        variant="subtle"
      />

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard
          v-for="result in results"
          :key="result.id"
          variant="subtle"
          :ui="{ body: 'p-4' }"
        >
          <div class="flex gap-3">
            <div class="w-16 h-24 rounded-md overflow-hidden bg-muted shrink-0 ring ring-default">
              <NuxtImg
                v-if="result.coverUrl"
                :src="result.coverUrl"
                :alt="result.title"
                width="64"
                height="96"
                sizes="64px"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <UIcon name="i-lucide-image" class="size-5 text-muted" />
              </div>
            </div>

            <div class="min-w-0 flex-1 space-y-2">
              <div>
                <h3 class="text-sm font-semibold leading-snug line-clamp-2">{{ result.title }}</h3>
                <p v-if="result.status" class="text-xs text-muted mt-1 capitalize">{{ result.status }}</p>
              </div>

              <p v-if="result.description" class="text-xs text-toned line-clamp-2">
                {{ result.description }}
              </p>

              <UButton
                size="xs"
                color="primary"
                variant="outline"
                icon="i-lucide-download"
                :loading="importingId === result.id"
                :disabled="!!importingId"
                @click="triggerImport(result)"
              >
                {{ importingId === result.id ? 'Importing...' : 'Import' }}
              </UButton>
            </div>
          </div>
        </UCard>
      </div>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
import type { FetchError } from 'ofetch'

definePageMeta({ layout: 'admin' })

useHead({ title: 'Import — Skald Scan Dashboard' })

const toast = useToast()

interface MangaDexResult {
  id: string
  title: string
  description: string | null
  coverUrl: string | null
  author: string | null
  status: string | null
  tags: string[]
}

const query = ref('')
const lastQuery = ref('')
const hasSearched = ref(false)
const searching = ref(false)
const error = ref(false)
const results = ref<MangaDexResult[]>([])
const importingId = ref<string | null>(null)
const importStatus = ref<{ title: string; message: string; error: boolean } | null>(null)

async function doSearch() {
  const q = query.value.trim()
  if (!q) return

  lastQuery.value = q
  searching.value = true
  error.value = false
  hasSearched.value = true
  importStatus.value = null

  try {
    results.value = await $fetch<MangaDexResult[]>('/api/mangadex/search', {
      params: { q },
    })
  } catch {
    error.value = true
    results.value = []
  } finally {
    searching.value = false
  }
}

function getFetchErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const fetchError = err as FetchError
    const data = fetchError.data
    if (data && typeof data === 'object') {
      if ('message' in data && typeof data.message === 'string' && data.message.length > 0) {
        return data.message
      }
      if ('statusMessage' in data && typeof data.statusMessage === 'string' && data.statusMessage.length > 0) {
        return data.statusMessage
      }
    }
    if (typeof fetchError.statusMessage === 'string' && fetchError.statusMessage.length > 0) {
      return fetchError.statusMessage
    }
  }

  if (err instanceof Error) {
    return err.message
  }

  return 'Unknown error'
}

async function triggerImport(manga: MangaDexResult) {
  importingId.value = manga.id
  importStatus.value = { title: manga.title, message: 'Importing...', error: false }

  try {
    const { jobId } = await $fetch<{ jobId: string }>('/api/mangadex/import', {
      method: 'POST',
      body: { mangaDexId: manga.id },
    })

    const message = existingManga
      ? `Already in library — chapter sync retried (job ${jobId.slice(0, 8)}).`
      : `Import complete (job ${jobId.slice(0, 8)}). Check your library.`
    importStatus.value = {
      title: manga.title,
      message,
      error: false,
    }
    toast.add({
      title: 'Import complete',
      description: `${manga.title} was added to your library.`,
      color: 'success',
      icon: 'i-lucide-check-circle',
    })
  } catch (err) {
    const message = getFetchErrorMessage(err)
    importStatus.value = {
      title: `${manga.title} — Import failed`,
      message,
      error: true,
    }
    toast.add({
      title: 'Import failed',
      description: message,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    importingId.value = null
  }
}
</script>
