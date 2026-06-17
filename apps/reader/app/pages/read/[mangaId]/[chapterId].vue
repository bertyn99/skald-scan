<template>
  <div class="fixed inset-0 bg-black z-50 flex flex-col">
    <ReaderOfflineBanner />
    <!-- Top overlay: controls -->
    <div
      class="absolute top-0 left-0 right-0 z-10 transition-opacity duration-300"
      :class="showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <UButton
          variant="ghost"
          color="neutral"
          class="text-white hover:bg-white/10"
          icon="i-lucide-arrow-left"
          @click="navigateTo(`/manga/${mangaId}`)"
        />
        <div class="text-center text-white text-sm truncate mx-4">
          <p class="font-medium">{{ chapterTitle }}</p>
          <p class="text-white/60 text-xs">Ch. {{ chapterNumber }}</p>
        </div>
        <div class="flex items-center gap-1">
          <ReaderDownloadButton :manga-id="mangaId" :chapter-id="chapterId" />
          <UButton variant="ghost" color="neutral" class="text-white hover:bg-white/10" icon="i-lucide-settings" />
        </div>
      </div>
    </div>

    <!-- Bottom overlay: page counter + chapter nav -->
    <div
      class="absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-300"
      :class="showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
        <UButton
          v-if="prevChapterId"
          variant="ghost"
          color="neutral"
          class="text-white hover:bg-white/10"
          icon="i-lucide-chevron-left"
          @click="navigateTo(`/read/${mangaId}/${prevChapterId}`)"
        >
          Prev
        </UButton>
        <span v-else />

        <span class="text-white text-sm font-mono">
          {{ currentPage }} / {{ totalPages }}
        </span>

        <UButton
          v-if="nextChapterId"
          variant="ghost"
          color="neutral"
          class="text-white hover:bg-white/10"
          trailing
          icon="i-lucide-chevron-right"
          @click="navigateTo(`/read/${mangaId}/${nextChapterId}`)"
        >
          Next
        </UButton>
        <span v-else />
      </div>
    </div>

    <!-- Page images -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto"
      @click="showOverlay = !showOverlay"
    >
      <div class="max-w-4xl mx-auto">
        <div
          v-for="page in totalPages"
          :key="page"
          class="relative"
          :data-page="page"
        >
          <ReaderPageImage
            :src="pageUrl(page)"
            :page-number="page"
            :total-pages="totalPages"
            @visible="onPageVisible"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MangaFull, ChapterSummary } from '@skald-scan/shared'

definePageMeta({ layout: false })

const route = useRoute()
const mangaId = route.params.mangaId as string
const chapterId = route.params.chapterId as string

useHead({ title: 'Reading — Skald Scan' })

const showOverlay = ref(true)
const currentPage = ref(1)
const totalPages = ref(0)
const chapterNumber = ref(0)
const chapterTitle = ref('')
const prevChapterId = ref<string | null>(null)
const nextChapterId = ref<string | null>(null)
const scrollContainer = ref<HTMLElement | null>(null)

let overlayTimer: ReturnType<typeof setTimeout> | null = null

function autoHideOverlay() {
  if (overlayTimer) clearTimeout(overlayTimer)
  overlayTimer = setTimeout(() => { showOverlay.value = false }, 3000)
}

watch(showOverlay, (v) => {
  if (v) autoHideOverlay()
})

const { data: response } = await useFetch<{ manga: MangaFull; chapters: ChapterSummary[] }>(`/api/proxy/manga/${mangaId}`)

// Wait for chapter data, then find current chapter and set state
watchEffect(() => {
  const chapters = response.value?.chapters
  if (!chapters) return
  const sorted = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)
  const idx = sorted.findIndex(c => c.id === chapterId)
  if (idx === -1) return

  const chapter = sorted[idx]
  if (!chapter) return

  chapterNumber.value = chapter.chapterNumber
  chapterTitle.value = chapter.title
  totalPages.value = chapter.pagesCount
  prevChapterId.value = idx > 0 ? sorted[idx - 1]?.id ?? null : null
  nextChapterId.value = idx < sorted.length - 1 ? sorted[idx + 1]?.id ?? null : null
})

function pageUrl(page: number): string {
  return `/api/proxy/manga/${mangaId}/chapters/${chapterId}/pages/${page}`
}

function onPageVisible(page: number) {
  currentPage.value = page
}

// Keyboard navigation
onMounted(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && prevChapterId.value) {
      navigateTo(`/read/${mangaId}/${prevChapterId.value}`)
    } else if (e.key === 'ArrowRight' && nextChapterId.value) {
      navigateTo(`/read/${mangaId}/${nextChapterId.value}`)
    }
  }
  window.addEventListener('keydown', handler)
  onUnmounted(() => window.removeEventListener('keydown', handler))
})

autoHideOverlay()
</script>
