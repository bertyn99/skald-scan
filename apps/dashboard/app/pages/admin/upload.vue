<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Upload Manga</h1>
    </div>

    <UCard>
      <div class="space-y-6">
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
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Brief description..."
          />
        </UFormField>

        <UFormField label="Cover Image">
          <AdminUploadDropzone
            accept="image/*"
            :max-size="5 * 1024 * 1024"
            @upload="handleCoverUpload"
          />
          <div v-if="coverPreview" class="mt-2">
            <img :src="coverPreview" alt="Cover preview" class="w-32 h-44 object-cover rounded-lg border" />
          </div>
        </UFormField>

        <USeparator />

        <div class="space-y-3">
          <h3 class="text-lg font-semibold">Chapter Archive</h3>
          <p class="text-sm text-muted-foreground">Upload a ZIP or CBZ file containing chapter pages.</p>

          <UFormField label="Chapter Number" required>
            <UInput v-model.number="chapterNumber" type="number" placeholder="1" min="1" />
          </UFormField>

          <AdminUploadDropzone
            accept=".zip,.cbz"
            :max-size="100 * 1024 * 1024"
            @upload="handleZipUpload"
          />

          <div v-if="zipStatus" class="flex items-center gap-2 text-sm">
            <UIcon
              :name="zipStatus.success ? 'i-lucide-check-circle' : 'i-lucide-loader-2'"
              :class="['w-4 h-4', zipStatus.success ? 'text-success' : 'animate-spin text-primary']"
            />
            <span>{{ zipStatus.message }}</span>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <UButton variant="outline" color="neutral" to="/admin/library">Cancel</UButton>
          <UButton
            color="primary"
            :disabled="!form.title || creating"
            :loading="creating"
            @click="createManga"
          >
            Create Manga
          </UButton>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

useHead({ title: 'Upload — Skald Scan Dashboard' })

const form = reactive({
  title: '',
  author: '',
  artist: '',
  description: '',
  tags: '',
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
    coverData.value = (e.target?.result as string).split(',')[1]
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
          content: base64,
        },
      })
      zipStatus.value = { success: true, message: `Uploaded ${file.name} — extraction queued.` }
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
        coverUrl: coverData.value ? `data:uploaded` : null,
      },
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
