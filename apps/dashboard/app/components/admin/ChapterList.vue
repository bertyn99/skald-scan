<template>
  <div v-if="chapters.length === 0" class="text-center py-8 text-muted-foreground">
    <UIcon name="i-lucide-list" class="w-8 h-8 mx-auto mb-2" />
    <p>No chapters yet.</p>
  </div>

  <div v-else class="border border-border rounded-lg overflow-hidden">
    <table class="w-full text-sm">
      <thead class="bg-muted/50">
        <tr>
          <th class="text-left px-4 py-2 font-medium">#</th>
          <th class="text-left px-4 py-2 font-medium">Title</th>
          <th class="text-left px-4 py-2 font-medium">Language</th>
          <th class="text-left px-4 py-2 font-medium">Pages</th>
          <th class="text-left px-4 py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="chapter in sortedChapters"
          :key="chapter.id"
          class="border-t border-border hover:bg-muted/30 transition-colors"
        >
          <td class="px-4 py-2 text-muted-foreground">{{ chapter.chapterNumber }}</td>
          <td class="px-4 py-2 font-medium">{{ chapter.title }}</td>
          <td class="px-4 py-2 text-muted-foreground">{{ chapter.language.toUpperCase() }}</td>
          <td class="px-4 py-2 text-muted-foreground">{{ chapter.pagesCount }}</td>
          <td class="px-4 py-2">
            <UBadge :color="chapterStatusColor(chapter.status)" variant="subtle" size="xs">
              {{ chapter.status }}
            </UBadge>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { ChapterSummary } from '@skald-scan/shared'

const props = defineProps<{
  chapters: ChapterSummary[]
}>()

const sortedChapters = computed(() =>
  [...props.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)
)

function chapterStatusColor(status: string): 'success' | 'primary' | 'error' | 'neutral' {
  switch (status) {
    case 'ready': return 'success'
    case 'downloading': return 'primary'
    case 'error': return 'error'
    default: return 'neutral'
  }
}
</script>
