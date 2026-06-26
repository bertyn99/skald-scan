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
            icon="i-lucide-upload"
            variant="outline"
            color="neutral"
            label="Upload chapter"
            @click="showZipUpload = true"
          />
          <UButton
            v-if="mangaData.mangaDexId"
            icon="i-lucide-refresh-cw"
            variant="outline"
            color="neutral"
            label="Sync now"
            :loading="syncing"
            @click="triggerSync"
          />
          <UButton
            v-if="!editing"
            icon="i-lucide-pencil"
            variant="outline"
            color="neutral"
            label="Edit metadata"
            @click="startEditing"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="outline"
            color="error"
            label="Delete"
            @click="showDeleteModal = true"
          />
        </template>
      </UPageHeader>

      <UPageBody class="space-y-8">
        <div class="flex flex-col md:flex-row gap-6">
          <div class="space-y-3 shrink-0">
            <div class="w-40 h-56 rounded-lg overflow-hidden bg-muted ring ring-default">
              <img
                v-if="displayCoverUrl"
                :src="displayCoverUrl"
                :alt="mangaData.title"
                class="w-full h-full object-cover"
              >
              <div v-else class="w-full h-full flex items-center justify-center">
                <UIcon name="i-lucide-image" class="size-8 text-muted" />
              </div>
            </div>
            <AdminUploadDropzone
              accept="image/*"
              :max-size="5 * 1024 * 1024"
              @upload="handleCoverUpload"
            />
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
                <a
                  v-if="mangaData.mangaDexId"
                  :href="`https://mangadex.org/title/${mangaData.mangaDexId}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <UIcon name="i-lucide-external-link" class="size-3" />
                  MangaDex
                </a>
                <span v-if="syncInfo?.lastSyncedAt">
                  Last synced {{ formatDate(syncInfo.lastSyncedAt) }}
                </span>
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

        <AdminChapterImportStats
          v-if="mangaData.mangaDexId && chapterStats"
          :stats="chapterStats"
          :sync="syncInfo"
        />

        <UCard v-if="mangaData.mangaDexId" variant="subtle">
          <div class="space-y-3">
            <div>
              <h3 class="text-sm font-semibold">Mirrored languages</h3>
              <p class="text-xs text-muted mt-0.5">
                Languages synced from MangaDex for this title. Removing a language
                soft-deletes its chapters and translations on next sync.
              </p>
            </div>
            <USelectMenu
              v-model="selectedLanguages"
              :items="languageItems"
              multiple
              value-key="value"
              label-key="label"
              class="w-full"
            />
            <div class="flex items-center gap-2">
              <UButton
                size="xs"
                color="primary"
                :loading="savingLanguages"
                :disabled="!languagesDirty"
                @click="saveLanguages"
              >
                Save languages
              </UButton>
              <UButton
                size="xs"
                variant="outline"
                color="neutral"
                icon="i-lucide-refresh-cw"
                :disabled="!languagesDirty"
                @click="triggerSync"
              >
                Re-sync after save
              </UButton>
            </div>
          </div>
        </UCard>

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

    <UModal v-model:open="showLanguageRemovalConfirm" title="Confirm language removal">
      <template #body>
        <p class="text-sm text-toned">
          Removing languages will soft-delete their chapters and translations on
          the next sync. Page objects in R2 are reclaimed too. This cannot be
          undone without re-importing.
        </p>
      </template>
      <template #footer>
        <UButton variant="outline" color="neutral" @click="cancelLanguageRemoval">
          Cancel
        </UButton>
        <UButton color="error" @click="confirmLanguageRemoval">
          Remove and re-sync
        </UButton>
      </template>
    </UModal>

    <UModal v-model:open="showZipUpload" title="Upload chapter ZIP">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Chapter number" required>
            <UInput v-model.number="zipChapterNumber" type="number" min="1" class="max-w-32" />
          </UFormField>
          <AdminUploadDropzone
            accept=".zip,.cbz"
            :max-size="100 * 1024 * 1024"
            :disabled="zipUploading"
            @upload="handleZipUpload"
          />
          <UAlert
            v-if="zipStatus"
            :color="zipStatus.success ? 'success' : 'info'"
            variant="subtle"
            :title="zipStatus.message"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showDeleteModal" title="Delete manga">
      <template #body>
        <p class="text-sm text-toned">
          Soft-delete <strong>{{ mangaData?.title }}</strong>? It will be removed from the library.
        </p>
      </template>
      <template #footer>
        <UButton variant="outline" color="neutral" @click="showDeleteModal = false">
          Cancel
        </UButton>
        <UButton color="error" :loading="deleting" @click="confirmDelete">
          Delete
        </UButton>
      </template>
    </UModal>
  </UPage>
</template>

<script setup lang="ts">
import type {
  ChapterImportStats,
  ChapterSummary,
  MangaFull,
  MangaSyncInfo
} from '@skald-scan/shared'
import { Language } from '@skald-scan/shared'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const mangaId = route.params.id as string

useHead({ title: 'Manga Detail — Skald Scan Dashboard' })

type MangaDetailResponse = {
  manga: MangaFull
  chapters: ChapterSummary[]
  sync: MangaSyncInfo | null
  chapterStats: ChapterImportStats
}

// Admin views always operate on canonical EN metadata — the edit form saves
// to manga.title/description (canonical), so pre-filling with a localized
// title would clobber the English canonical on save.
const { data: response, pending, error, refresh } = await useFetch<MangaDetailResponse>(`/api/manga/${mangaId}`, {
  query: { lang: 'en' }
})

const mangaData = computed(() => response.value?.manga)
const chapters = computed(() => response.value?.chapters ?? [])
const syncInfo = computed(() => response.value?.sync ?? null)
const chapterStats = computed(() => response.value?.chapterStats ?? null)
const displayCoverUrl = computed(() =>
  mangaData.value ? mangaCoverUrl(mangaData.value.id, mangaData.value.coverUrl) : null
)

const breadcrumbItems = computed(() => [
  { label: 'Library', to: '/admin/library', icon: 'i-lucide-library' },
  { label: mangaData.value?.title ?? 'Loading...' }
])

const editing = ref(false)
const saving = ref(false)
const syncing = ref(false)
const deleting = ref(false)
const showZipUpload = ref(false)
const showDeleteModal = ref(false)
const zipChapterNumber = ref(1)

// Mirrored-languages management. The USelectMenu uses value-key="value" so
// v-model receives the language codes directly as string[].
type LanguageItem = { label: string; value: string }
const selectedLanguages = ref<string[]>([])
const savedLanguages = ref<string[]>([])
const savingLanguages = ref(false)
const showLanguageRemovalConfirm = ref(false)
let pendingLanguageRemoval: (() => Promise<void>) | null = null

const languageItems: LanguageItem[] = (Object.values(Language) as string[]).map(code => ({
  label: code.toUpperCase(),
  value: code
}))

const languagesDirty = computed(() => {
  const a = [...selectedLanguages.value].sort()
  const b = [...savedLanguages.value].sort()
  return a.join(',') !== b.join(',')
})

watch(syncInfo, (info) => {
  if (info?.languages) {
    selectedLanguages.value = [...info.languages]
    savedLanguages.value = [...info.languages]
  }
}, { immediate: true })

async function saveLanguages() {
  const removed = savedLanguages.value.filter(l => !selectedLanguages.value.includes(l))
  if (removed.length > 0) {
    // Defer the actual save behind the confirm modal.
    pendingLanguageRemoval = doSaveLanguages
    showLanguageRemovalConfirm.value = true
    return
  }
  await doSaveLanguages()
}

async function doSaveLanguages() {
  savingLanguages.value = true
  showLanguageRemovalConfirm.value = false
  try {
    await $fetch(`/api/manga/${mangaId}/languages`, {
      method: 'PUT',
      body: { languages: selectedLanguages.value }
    })
    savedLanguages.value = [...selectedLanguages.value]
    toast.add({ title: 'Languages updated; sync queued', color: 'success' })
    await refresh()
  } catch (err) {
    toast.add({ title: 'Failed to save languages', description: (err as Error).message, color: 'error' })
  } finally {
    savingLanguages.value = false
    pendingLanguageRemoval = null
  }
}

async function cancelLanguageRemoval() {
  // Restore the saved selection without writing.
  selectedLanguages.value = [...savedLanguages.value]
  showLanguageRemovalConfirm.value = false
  pendingLanguageRemoval = null
}

async function confirmLanguageRemoval() {
  if (pendingLanguageRemoval) await pendingLanguageRemoval()
}

const mangaIdRef = computed(() => mangaId)
const { uploading: zipUploading, status: zipStatus, uploadChapterZip } = useChapterZipUpload(mangaIdRef)

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
    toast.add({ title: 'Metadata saved', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Save failed', description: (err as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function triggerSync() {
  syncing.value = true
  try {
    await $fetch(`/api/manga/${mangaId}/sync`, { method: 'POST' })
    toast.add({ title: 'Sync queued', color: 'success' })
    await refresh()
  } catch (err) {
    toast.add({ title: 'Sync failed', description: (err as Error).message, color: 'error' })
  } finally {
    syncing.value = false
  }
}

async function handleCoverUpload(file: File) {
  try {
    await uploadMangaCover(mangaId, file)
    await refresh()
    toast.add({ title: 'Cover uploaded', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Cover upload failed', description: (err as Error).message, color: 'error' })
  }
}

async function handleZipUpload(file: File) {
  const chapterId = await uploadChapterZip(file, zipChapterNumber.value)
  if (chapterId) {
    await refresh()
    showZipUpload.value = false
  }
}

async function confirmDelete() {
  deleting.value = true
  try {
    await $fetch(`/api/manga/${mangaId}`, { method: 'DELETE' })
    toast.add({ title: 'Manga deleted', color: 'success' })
    await router.push('/admin/library')
  } catch (err) {
    toast.add({ title: 'Delete failed', description: (err as Error).message, color: 'error' })
  } finally {
    deleting.value = false
    showDeleteModal.value = false
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
    return tags.split(',').map(t => t.trim()).filter(Boolean)
  }
}
</script>
