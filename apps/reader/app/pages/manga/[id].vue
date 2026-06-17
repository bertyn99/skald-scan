<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <NuxtLink to="/library" class="hover:text-foreground transition-colors">Library</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="w-4 h-4" />
      <span class="text-foreground">{{ mangaData?.title ?? 'Loading...' }}</span>
    </div>

    <div v-if="pending" class="space-y-6">
      <USkeleton class="h-8 w-64" />
      <USkeleton class="h-64 w-full" />
    </div>

    <div v-else-if="error" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
      <p>Failed to load manga.</p>
      <UButton variant="outline" class="mt-4" @click="() => refresh()">Retry</UButton>
    </div>

    <template v-else-if="mangaData">
      <div class="flex gap-6 flex-col md:flex-row">
        <div class="w-48 h-64 rounded-lg overflow-hidden bg-muted flex-shrink-0 mx-auto md:mx-0">
          <img
            v-if="mangaData.coverUrl"
            :src="mangaData.coverUrl"
            :alt="mangaData.title"
            class="w-full h-full object-cover"
          >
          <div v-else class="w-full h-full flex items-center justify-center">
            <UIcon name="i-lucide-image" class="w-10 h-10 text-muted-foreground" />
          </div>
        </div>

        <div class="flex-1 space-y-3">
          <div class="flex items-start justify-between gap-4">
            <h1 class="text-2xl font-bold">{{ mangaData.title }}</h1>
            <UBadge :color="statusColor" variant="subtle" size="lg">
              {{ mangaData.status }}
            </UBadge>
          </div>

          <div v-if="mangaData.author" class="text-sm text-muted-foreground">
            <UIcon name="i-lucide-user" class="w-4 h-4 inline mr-1" />
            {{ mangaData.author }}
            <span v-if="mangaData.artist && mangaData.artist !== mangaData.author">
              &middot; Art: {{ mangaData.artist }}
            </span>
          </div>

          <p v-if="mangaData.description" class="text-sm text-muted-foreground leading-relaxed">
            {{ mangaData.description }}
          </p>

          <div class="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{{ mangaData.chapterCount }} chapters</span>
            <span>Updated {{ formatDate(mangaData.updatedAt) }}</span>
          </div>

          <div v-if="mangaData.tags" class="flex flex-wrap gap-1">
            <UBadge
              v-for="tag in parseTags(mangaData.tags)"
              :key="tag"
              variant="outline"
              color="neutral"
              size="xs"
            >
              {{ tag }}
            </UBadge>
          </div>
        </div>
      </div>

      <USeparator />

      <div class="space-y-3">
        <h2 class="text-lg font-semibold">Chapters</h2>

        <div v-if="chapters.length === 0" class="text-center py-8 text-muted-foreground">
          <UIcon name="i-lucide-list" class="w-8 h-8 mx-auto mb-2" />
          <p>No chapters available yet.</p>
        </div>

        <div v-else class="space-y-1">
          <NuxtLink
            v-for="chapter in sortedChapters"
            :key="chapter.id"
            :to="`/read/${mangaData.id}/${chapter.id}`"
            class="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div class="flex items-center gap-3">
              <span class="text-sm font-mono text-muted-foreground w-8">Ch. {{ chapter.chapterNumber }}</span>
              <span class="text-sm font-medium group-hover:text-primary transition-colors">{{ chapter.title }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted-foreground">{{ chapter.pagesCount }} pages</span>
              <UBadge :color="chapter.status === ChapterStatus.Available ? 'success' : 'neutral'" variant="subtle" size="xs">
                {{ chapter.language.toUpperCase() }}
              </UBadge>
            </div>
          </NuxtLink>
        </div>
      </div>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
import type { MangaFull, ChapterSummary } from '@skald-scan/shared'
import { ChapterStatus } from '@skald-scan/shared'

const route = useRoute()
const mangaId = route.params.id as string

useHead({ title: 'Manga — Skald Scan' })

const { data: response, pending, error, refresh } = await useFetch<{ manga: MangaFull; chapters: ChapterSummary[] }>(`/api/proxy/manga/${mangaId}`)

const mangaData = computed(() => response.value?.manga)
const chapters = computed(() => response.value?.chapters ?? [])

const sortedChapters = computed(() =>
  [...chapters.value].sort((a, b) => a.chapterNumber - b.chapterNumber)
)

const statusColor = computed(() => {
  switch (mangaData.value?.status) {
    case 'completed': return 'success'
    case 'ongoing': return 'primary'
    case 'hiatus': return 'warning'
    case 'cancelled': return 'error'
    default: return 'neutral'
  }
})

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function parseTags(tags: string | null): string[] {
  if (!tags) return []
  try { return JSON.parse(tags) } catch { return [] }
}
</script>
