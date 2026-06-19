<template>
  <UEmpty
    v-if="chapters.length === 0"
    icon="i-lucide-list"
    title="No chapters yet"
    description="Chapters will appear here after import or upload."
    variant="subtle"
    size="sm"
  />

  <UCard v-else variant="subtle" :ui="{ body: 'p-0 sm:p-0' }">
    <UTable :data="sortedChapters" :columns="columns" />
  </UCard>
</template>

<script setup lang="ts">
import type { ChapterSummary } from '@skald-scan/shared'
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'

const props = defineProps<{
  chapters: ChapterSummary[]
}>()

const UBadge = resolveComponent('UBadge')

const sortedChapters = computed(() =>
  [...props.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber)
)

const columns: TableColumn<ChapterSummary>[] = [
  {
    accessorKey: 'chapterNumber',
    header: '#',
    cell: ({ row }) => h('span', { class: 'text-muted tabular-nums' }, row.original.chapterNumber)
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => h('span', { class: 'font-medium' }, row.original.title)
  },
  {
    accessorKey: 'language',
    header: 'Language',
    cell: ({ row }) => h('span', { class: 'text-muted uppercase text-xs' }, row.original.language)
  },
  {
    accessorKey: 'pagesCount',
    header: 'Pages',
    cell: ({ row }) => h('span', { class: 'text-muted tabular-nums' }, row.original.pagesCount)
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => h(UBadge, {
      color: chapterStatusColor(row.original.status),
      variant: 'subtle',
      size: 'xs'
    }, () => row.original.status)
  }
]

function chapterStatusColor(status: string): 'success' | 'primary' | 'error' | 'neutral' | 'warning' {
  switch (status) {
    case 'available': return 'success'
    case 'processing': return 'primary'
    case 'unavailable': return 'error'
    default: return 'neutral'
  }
}
</script>
