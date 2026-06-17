<template>
  <UPage>
    <UBreadcrumb :items="breadcrumbItems" class="mb-2" />

    <div v-if="pending" class="space-y-6">
      <div class="flex gap-6">
        <USkeleton class="w-40 h-56 rounded-lg shrink-0" />
        <div class="flex-1 space-y-3">
          <USkeleton class="h-8 w-2/3" />
          <USkeleton class="h-4 w-1/3" />
          <USkeleton class="h-20 w-full" />
        </div>
      </div>
      <USkeleton class="h-48 w-full rounded-lg" />
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-alert-circle"
      title="Could not load manga"
      description="This title could not be fetched."
      :actions="[{ label: 'Retry', color: 'error', variant: 'outline', onClick: () => refresh() }]"
    />

    <template v-else-if="mangaData">
      <UPageHeader :title="mangaData.title">
        <template #links>
          <UBadge :color="statusColor" variant="subtle" size="lg">
            {{ mangaData.status }}
          </UBadge>
          <UButton
            v-if="!editing"
            icon="i-lucide-pencil"
            variant="outline"
            color="neutral"
            label="Edit metadata"
            @click="startEditing"
          />
        </template>
      </UPageHeader>

      <UPageBody class="space-y-8">
        <div class="flex flex-col md:flex-row gap-6">
          <div class="w-40 h-56 rounded-lg overflow-hidden bg-muted shrink-0 ring ring-default">
            <img
              v-if="mangaData.coverUrl"
              :src="mangaData.coverUrl"
              :alt="mangaData.title"
              class="w-full h-full object-cover"
            >
            <div v-else class="w-full h-full flex items-center justify-center">
              <UIcon name="i-lucide-image" class="size-8 text-muted" />
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <template v-if="!editing">
              <div v-if="mangaData.author" class="text-sm text-muted mb-3">
                <UIcon name="i-lucide-user" class="size-4 inline mr-1 align-text-bottom" />
                {{ mangaData.author }}
                <span v-if="mangaData.artist && mangaData.artist !== mangaData.author">
                  · Art: {{ mangaData.artist }}
                </span>
              </div>

              <p v-if="mangaData.description" class="text-sm text-toned leading-relaxed mb-4">
                {{ mangaData.description }}
              </p>

              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted tabular-nums mb-4">
                <span>{{ mangaData.chapterCount }} chapters</span>
                <span>Added {{ formatDate(mangaData.createdAt) }}</span>
                <span>Updated {{ formatDate(mangaData.updatedAt) }}</span>
              </div>

              <div v-if="mangaData.tags" class="flex flex-wrap gap-1.5">
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

            <UCard v-else variant="subtle" class="w-full">
              <div class="space-y-4">
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
                  <UTextarea v-model="editForm.description" :rows="3" autoresize />
                </UFormField>
                <UFormField label="Tags (comma separated)">
                  <UInput v-model="editForm.tags" />
                </UFormField>
                <div class="flex justify-end gap-2 pt-1">
                  <UButton variant="outline" color="neutral" @click="editing = false">
                    Cancel
                  </UButton>
                  <UButton color="primary" :loading="saving" @click="saveMetadata">
                    Save changes
                  </UButton>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <section class="space-y-4">
          <div>
            <h2 class="text-base font-semibold text-highlighted">Chapters</h2>
            <p class="text-sm text-muted mt-0.5">
              {{ chapters.length }} chapter{{ chapters.length === 1 ? '' : 's' }} in this title
            </p>
          </div>
          <AdminChapterList :chapters="chapters" />
        </section>
      </UPageBody>
    </template>
  </UPage>
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

const breadcrumbItems = computed(() => [
  { label: 'Library', to: '/admin/library', icon: 'i-lucide-library' },
  { label: mangaData.value?.title ?? 'Loading...' }
])

const editing = ref(false)
const saving = ref(false)

const statusOptions = [
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Hiatus', value: 'hiatus' },
  { label: 'Cancelled', value: 'cancelled' }
]

const editForm = reactive({
  title: '',
  author: '',
  artist: '',
  description: '',
  tags: '',
  status: 'ongoing'
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
        status: editForm.status
      }
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
