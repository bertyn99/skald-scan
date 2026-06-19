<template>
  <UPage>
    <UPageHeader
      title="Upload manga"
      description="Create a new title manually, then attach chapter archives."
      :links="[{ label: 'Back to library', icon: 'i-lucide-arrow-left', to: '/admin/library', color: 'neutral', variant: 'ghost' }]"
    />

    <UPageBody>
      <UCard variant="subtle">
        <div class="space-y-8">
          <div class="space-y-4">
            <h2 class="text-sm font-semibold text-highlighted">Metadata</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="Title" required>
                <UInput v-model="form.title" placeholder="Manga title" :disabled="!!createdMangaId" />
              </UFormField>
              <UFormField label="Author">
                <UInput v-model="form.author" placeholder="Author name" :disabled="!!createdMangaId" />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="Artist">
                <UInput v-model="form.artist" placeholder="Artist name" :disabled="!!createdMangaId" />
              </UFormField>
              <UFormField label="Tags (comma separated)">
                <UInput v-model="form.tags" placeholder="action, comedy, romance" :disabled="!!createdMangaId" />
              </UFormField>
            </div>

            <UFormField label="Description">
              <UTextarea
                v-model="form.description"
                :rows="3"
                placeholder="Brief description..."
                autoresize
                :disabled="!!createdMangaId"
              />
            </UFormField>

            <UFormField label="Cover image">
              <AdminUploadDropzone
                accept="image/*"
                :max-size="5 * 1024 * 1024"
                :disabled="!!createdMangaId"
                @upload="handleCoverUpload"
              />
              <div v-if="coverPreview" class="mt-3">
                <img
                  :src="coverPreview"
                  alt="Cover preview"
                  class="w-32 h-44 object-cover rounded-lg ring ring-default"
                >
              </div>
            </UFormField>
          </div>

          <USeparator />

          <div class="space-y-4">
            <div>
              <h2 class="text-sm font-semibold text-highlighted">Chapter archive</h2>
              <p class="text-sm text-muted mt-1">
                Upload a ZIP or CBZ file containing chapter pages after the manga is created.
              </p>
            </div>

            <UFormField label="Chapter number" required>
              <UInput
                v-model.number="chapterNumber"
                type="number"
                placeholder="1"
                min="1"
                class="max-w-32"
                :disabled="!createdMangaId || zipUploading"
              />
            </UFormField>

            <AdminUploadDropzone
              accept=".zip,.cbz"
              :max-size="100 * 1024 * 1024"
              :disabled="!createdMangaId || zipUploading"
              @upload="handleZipUpload"
            />

            <UAlert
              v-if="zipStatus"
              :color="zipStatus.success ? 'success' : 'info'"
              variant="subtle"
              :icon="zipStatus.success ? 'i-lucide-check-circle' : 'i-lucide-loader-2'"
              :title="zipStatus.message"
              :ui="{ icon: zipStatus.success ? undefined : 'animate-spin' }"
            />
          </div>

          <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <UButton variant="outline" color="neutral" to="/admin/library">
              Cancel
            </UButton>
            <UButton
              v-if="!createdMangaId"
              color="primary"
              icon="i-lucide-plus"
              :disabled="!form.title || creating"
              :loading="creating"
              @click="createManga"
            >
              Create manga
            </UButton>
            <UButton
              v-else
              color="primary"
              icon="i-lucide-library"
              :to="`/admin/library/${createdMangaId}`"
            >
              Go to manga detail
            </UButton>
          </div>
        </div>
      </UCard>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

useHead({ title: 'Upload — Skald Scan Dashboard' })

const form = reactive({
  title: '',
  author: '',
  artist: '',
  description: '',
  tags: ''
})

const coverPreview = ref<string | null>(null)
const coverData = ref<string | null>(null)
const chapterNumber = ref(1)
const creating = ref(false)
const createdMangaId = ref<string | null>(null)

const { uploading: zipUploading, status: zipStatus, uploadChapterZip } = useChapterZipUpload(createdMangaId)

function handleCoverUpload(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    coverPreview.value = e.target?.result as string
    coverData.value = (e.target?.result as string).split(',')[1] ?? null
  }
  reader.readAsDataURL(file)
}

async function handleZipUpload(file: File) {
  await uploadChapterZip(file, chapterNumber.value)
}

async function createManga() {
  if (!form.title.trim()) return

  creating.value = true
  try {
    const tagsJson = form.tags.trim()
      ? JSON.stringify(form.tags.split(',').map(t => t.trim()).filter(Boolean))
      : null

    const result = await $fetch<{ item: { id: string } }>('/api/manga', {
      method: 'POST',
      body: {
        title: form.title.trim(),
        author: form.author.trim() || null,
        artist: form.artist.trim() || null,
        description: form.description.trim() || null,
        tags: tagsJson,
        coverUrl: coverData.value ? 'data:uploaded' : null
      }
    })

    createdMangaId.value = result.item.id

    if (coverData.value) {
      const blob = Uint8Array.from(atob(coverData.value), c => c.charCodeAt(0))
      await $fetch(`/api/manga/${result.item.id}/cover`, {
        method: 'POST',
        body: blob.buffer,
        headers: { 'Content-Type': 'image/webp' }
      })
    }
  } catch (err) {
    console.error('Failed to create manga:', err)
  } finally {
    creating.value = false
  }
}
</script>
