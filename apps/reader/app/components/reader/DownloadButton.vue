<template>
  <UButton
    variant="ghost"
    color="white"
    icon="i-lucide-download"
    size="sm"
    :loading="downloading"
    @click="download"
  />
</template>

<script setup lang="ts">
const props = defineProps<{
  mangaId: string
  chapterId: string
}>()

const downloading = ref(false)

async function download() {
  downloading.value = true
  try {
    const response = await fetch(`/api/proxy/manga/${props.mangaId}/chapters/${props.chapterId}/download`)
    if (!response.ok) throw new Error('Download failed')

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.chapterId}.cbz`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    // Download failure — UI stays in place, user can retry
  } finally {
    downloading.value = false
  }
}
</script>
