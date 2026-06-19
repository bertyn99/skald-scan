type UploadZipResponse = {
  queued: boolean
  jobId: string
  tempR2Key: string
}

type CreateChapterResponse = {
  item: {
    id: string
    chapterNumber: number
  }
}

export function useChapterZipUpload(mangaId: Ref<string | null> | string | null) {
  const resolvedMangaId = computed(() => {
    if (typeof mangaId === 'string' || mangaId === null) {
      return mangaId
    }
    return mangaId.value
  })

  const uploading = ref(false)
  const status = ref<{ success: boolean; message: string } | null>(null)

  async function uploadChapterZip(file: File, chapterNumber: number): Promise<string | null> {
    const id = resolvedMangaId.value
    if (!id) {
      status.value = { success: false, message: 'Manga must be created before uploading chapters.' }
      return null
    }

    if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
      status.value = { success: false, message: 'Chapter number must be at least 1.' }
      return null
    }

    uploading.value = true
    status.value = { success: false, message: 'Creating chapter...' }

    try {
      const chapter = await $fetch<CreateChapterResponse>(`/api/manga/${id}/chapters`, {
        method: 'POST',
        body: { chapterNumber }
      })

      status.value = { success: false, message: 'Uploading archive...' }

      const base64 = await readFileAsBase64(file)
      const result = await $fetch<UploadZipResponse>('/api/storage/upload-zip', {
        method: 'POST',
        body: {
          mangaId: id,
          chapterId: chapter.item.id,
          fileName: file.name,
          content: base64
        }
      })

      status.value = {
        success: true,
        message: `Uploaded ${file.name}. Extraction ${result.queued ? 'queued' : 'started'}.`
      }
      return chapter.item.id
    } catch (err) {
      status.value = { success: false, message: `Upload failed: ${(err as Error).message}` }
      return null
    } finally {
      uploading.value = false
    }
  }

  return {
    uploading,
    status,
    uploadChapterZip
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      const base64 = result.split(',')[1]
      if (!base64) {
        reject(new Error('Failed to read file'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
