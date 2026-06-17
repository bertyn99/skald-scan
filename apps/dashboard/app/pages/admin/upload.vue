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
                <UInput v-model="form.title" placeholder="Manga title" />
              </UFormField>
              <UFormField label="Author">
                <UInput v-model="form.author" placeholder="Author name" />
              </UFormField>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="Artist">
                <UInput v-model="form.artist" placeholder="Artist name" />
              </UFormField>
              <UFormField label="Tags (comma separated)">
                <UInput v-model="form.tags" placeholder="action, comedy, romance" />
              </UFormField>
            </div>

            <UFormField label="Description">
              <UTextarea
                v-model="form.description"
                :rows="3"
                placeholder="Brief description..."
                autoresize
              />
            </UFormField>

            <UFormField label="Cover image">
              <AdminUploadDropzone
                accept="image/*"
                :max-size="5 * 1024 * 1024"
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
              <UInput v-model.number="chapterNumber" type="number" placeholder="1" min="1" class="max-w-32" />
            </UFormField>

            <AdminUploadDropzone
              accept=".zip,.cbz"
              :max-size="100 * 1024 * 1024"
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
              color="primary"
              icon="i-lucide-plus"
              :disabled="!form.title || creating"
              :loading="creating"
              @click="createManga"
            >
              Create manga
            </UButton>
          </div>
        </div>
      </UCard>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

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

const zipStatus = ref<{ success: boolean; message: string } | null>(null)
const createdMangaId = ref<string | null>(null)

function handleCoverUpload(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    coverPreview.value = e.target?.result as string
    coverData.value = (e.target?.result as string).split(',')[1] ?? null
  }
  reader.readAsDataURL(file)
}

async function handleZipUpload(file: File) {
  if (!createdMangaId.value) {
    zipStatus.value = { success: false, message: 'Create the manga first, then upload chapters.' }
    return
  }

  zipStatus.value = { success: false, message: 'Uploading archive...' }

  const reader = new FileReader()
  reader.onload = async (e) => {
    const base64 = (e.target?.result as string).split(',')[1]
    const chapterId = crypto.randomUUID()

    try {
      await $fetch('/api/storage/upload-zip', {
        method: 'POST',
        body: {
          mangaId: createdMangaId.value,
          chapterId,
          fileName: file.name,
          content: base64
        }
      })
      zipStatus.value = { success: true, message: `Uploaded ${file.name}. Extraction queued.` }
    } catch (err) {
      zipStatus.value = { success: false, message: `Upload failed: ${(err as Error).message}` }
    }
  }
  reader.readAsDataURL(file)
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
        coverUrl: coverData.value ? `data:uploaded` : null
      }
    })

    createdMangaId.value = result.item.id
    zipStatus.value = { success: true, message: 'Manga created. You can now upload chapter archives.' }

    await navigateTo(`/admin/library/${result.item.id}`)
  } catch (err) {
    console.error('Failed to create manga:', err)
  } finally {
    creating.value = false
  }
}
</script>
