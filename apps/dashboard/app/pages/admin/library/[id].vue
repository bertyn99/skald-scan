<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <NuxtLink to="/admin/library" class="hover:text-foreground transition-colors">Library</NuxtLink>
      <UIcon name="i-lucide-chevron-right" class="w-4 h-4" />
      <span class="text-foreground">{{ mangaData?.title ?? 'Loading...' }}</span>
    </div>

    <div v-if="pending" class="space-y-6">
      <USkeleton class="h-8 w-64" />
      <USkeleton class="h-48 w-full" />
    </div>

    <div v-else-if="error" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
      <p>Failed to load manga.</p>
      <UButton variant="outline" class="mt-4" @click="() => refresh()">Retry</UButton>
    </div>

    <template v-else-if="mangaData">
      <div class="flex gap-6">
        <div class="w-40 h-56 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          <img
            v-if="mangaData.coverUrl"
            :src="mangaData.coverUrl"
            :alt="mangaData.title"
            class="w-full h-full object-cover"
          >
          <div v-else class="w-full h-full flex items-center justify-center">
            <UIcon name="i-lucide-image" class="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        <div class="flex-1 space-y-3">
          <!-- View mode -->
          <template v-if="!editing">
            <div class="flex items-start justify-between gap-4">
              <h1 class="text-2xl font-bold">{{ mangaData.title }}</h1>
              <div class="flex items-center gap-2">
                <UBadge :color="statusColor" variant="subtle" size="lg">
                  {{ mangaData.status }}
                </UBadge>
                <UButton icon="i-lucide-pencil" variant="ghost" size="sm" @click="startEditing">Edit</UButton>
              </div>
            </div>

            <div v-if="mangaData.author" class="text-sm text-muted-foreground">
              <UIcon name="i-lucide-user" class="w-4 h-4 inline mr-1" />
              {{ mangaData.author }}
              <span v-if="mangaData.artist && mangaData.artist !== mangaData.author">
                &middot; Art: {{ mangaData.artist }}
              </span>
            </div>

            <p v-if="mangaData.description" class="text-sm text-muted-foreground line-clamp-3">
              {{ mangaData.description }}
            </p>

            <div class="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{{ mangaData.chapterCount }} chapters</span>
              <span>Added {{ formatDate(mangaData.createdAt) }}</span>
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
          </template>

          <!-- Edit mode -->
          <template v-else>
            <div class="space-y-3">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <UFormField label="Title">
                  <UInput v-model="editForm.title" />
                </UFormField>
                <UFormField label="Status">
                  <USelect v-model="editForm.status" :items="statusOptions" />
                </UFormField>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <UFormField label="Author">
                  <UInput v-model="editForm.author" />
                </UFormField>
                <UFormField label="Artist">
                  <UInput v-model="editForm.artist" />
                </UFormField>
              </div>
              <UFormField label="Description">
                <textarea
                  v-model="editForm.description"
                  rows="3"
                  class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </UFormField>
              <UFormField label="Tags (comma separated)">
                <UInput v-model="editForm.tags" />
              </UFormField>
              <div class="flex justify-end gap-2 pt-2">
                <UButton variant="outline" color="neutral" @click="editing = false">Cancel</UButton>
                <UButton color="primary" :loading="saving" @click="saveMetadata">Save</UButton>
              </div>
            </div>
          </template>
        </div>
      </div>

      <USeparator />

      <div class="space-y-3">
        <h2 class="text-lg font-semibold">Chapters</h2>
        <AdminChapterList :chapters="chapters" />
      </div>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
import type { MangaFull, ChapterSummary } from '@skald-scan/shared'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const mangaId = route.params.id as string

useHead({ title: 'Manga Detail — Skald Scan Dashboard' })

const { data: response, pending, error, refresh } = await useFetch<{ manga: MangaFull; chapters: ChapterSummary[] }>(`/api/manga/${mangaId}`)

const mangaData = computed(() => response.value?.manga)
const chapters = computed(() => response.value?.chapters ?? [])

const editing = ref(false)
const saving = ref(false)

const statusOptions = [
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Hiatus', value: 'hiatus' },
  { label: 'Cancelled', value: 'cancelled' },
]

const editForm = reactive({
  title: '',
  author: '',
  artist: '',
  description: '',
  tags: '',
  status: 'ongoing',
})

function startEditing() {
  if (!mangaData.value) return
  editForm.title = mangaData.value.title
  editForm.author = mangaData.value.author ?? ''
  editForm.artist = mangaData.value.artist ?? ''
  editForm.description = mangaData.value.description ?? ''
  editForm.status = mangaData.value.status
  const tags = parseTags(mangaData.value.tags)
  editForm.tags = tags.join(', ')
  editing.value = true
}

async function saveMetadata() {
  if (!editForm.title.trim()) return
  saving.value = true
  try {
    const tagsJson = editForm.tags.trim()
      ? JSON.stringify(editForm.tags.split(',').map(t => t.trim()).filter(Boolean))
      : null
    await $fetch(`/api/manga/${mangaId}`, {
      method: 'PUT',
      body: {
        title: editForm.title.trim(),
        author: editForm.author.trim() || null,
        artist: editForm.artist.trim() || null,
        description: editForm.description.trim() || null,
        tags: tagsJson,
        status: editForm.status,
      },
    })
    editing.value = false
    await refresh()
  } catch (err) {
    console.error('Failed to save metadata:', err)
  } finally {
    saving.value = false
  }
}

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
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}
</script>
