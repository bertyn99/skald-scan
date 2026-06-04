<template>
  <UContainer class="py-8 space-y-6">
    <h1 class="text-2xl font-bold">Search MangaDex</h1>

    <form class="flex gap-2" @submit.prevent="doSearch">
      <UInput
        v-model="query"
        icon="i-lucide-search"
        placeholder="Search manga on MangaDex..."
        class="flex-1 max-w-lg"
        size="lg"
      />
      <UButton type="submit" color="primary" :loading="searching" :disabled="!query.trim()">
        Search
      </UButton>
    </form>

    <div v-if="!hasSearched" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-search" class="w-12 h-12 mx-auto mb-4" />
      <p>Search for manga on MangaDex to import into your library.</p>
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

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div
        v-for="result in results"
        :key="result.id"
        class="flex gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
      >
        <div class="w-20 h-28 rounded overflow-hidden bg-muted flex-shrink-0">
          <img
            v-if="result.coverUrl"
            :src="result.coverUrl"
            :alt="result.title"
            class="w-full h-full object-cover"
            loading="lazy"
          >
          <div v-else class="w-full h-full flex items-center justify-center">
            <UIcon name="i-lucide-image" class="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        <div class="flex-1 min-w-0 space-y-1">
          <h3 class="text-sm font-medium leading-tight line-clamp-2">{{ result.title }}</h3>
          <p v-if="result.author" class="text-xs text-muted-foreground">{{ result.author }}</p>
          <p v-if="result.description" class="text-xs text-muted-foreground line-clamp-2">{{ result.description }}</p>
          <div class="flex items-center gap-2 pt-1">
            <UBadge v-if="result.status" variant="subtle" size="xs">{{ result.status }}</UBadge>
            <UBadge v-if="result.tags?.length" variant="outline" color="neutral" size="xs">
              {{ result.tags.length }} tags
            </UBadge>
          </div>
          <div class="pt-1">
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
      </div>
    </div>

    <div v-if="importStatus" class="fixed bottom-4 right-4 z-50">
      <UCard class="shadow-lg">
        <div class="flex items-center gap-3">
          <UIcon
            :name="importStatus.done ? 'i-lucide-check-circle' : 'i-lucide-loader-2'"
            :class="['w-5 h-5', importStatus.done ? 'text-success' : 'animate-spin text-primary']"
          />
          <div>
            <p class="text-sm font-medium">{{ importStatus.title }}</p>
            <p class="text-xs text-muted-foreground">{{ importStatus.message }}</p>
          </div>
          <UButton v-if="importStatus.done" icon="i-lucide-x" variant="ghost" size="xs" @click="importStatus = null" />
        </div>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
useHead({ title: 'Search — Skald Scan' })

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
const importStatus = ref<{ title: string; message: string; done: boolean } | null>(null)

async function doSearch() {
  const q = query.value.trim()
  if (!q) return

  lastQuery.value = q
  searching.value = true
  error.value = false
  hasSearched.value = true

  try {
    const response = await $fetch<MangaDexResult[]>('/api/proxy/mangadex/search', {
      params: { q },
    })
    results.value = response
  } catch {
    error.value = true
    results.value = []
  } finally {
    searching.value = false
  }
}

async function triggerImport(manga: MangaDexResult) {
  importingId.value = manga.id
  importStatus.value = { title: manga.title, message: 'Queuing import...', done: false }

  try {
    const { jobId } = await $fetch<{ jobId: string }>('/api/proxy/mangadex/import', {
      method: 'POST',
      body: { mangaDexId: manga.id },
    })

    importStatus.value = { title: manga.title, message: `Import started (job: ${jobId.slice(0, 8)}...)`, done: true }

    setTimeout(() => {
      importStatus.value = null
    }, 4000)
  } catch (err) {
    importStatus.value = { title: manga.title, message: `Import failed: ${(err as Error).message}`, done: true }
  } finally {
    importingId.value = null
  }
}
</script>
