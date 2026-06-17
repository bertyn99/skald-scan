<template>
  <div
    class="rounded-lg border-2 border-dashed border-default bg-elevated/30 p-8 text-center cursor-pointer transition-colors hover:border-primary/40 hover:bg-elevated/60 focus-within:ring-2 focus-within:ring-primary/30"
    :class="{ 'border-primary bg-primary/5': isDragging }"
    role="button"
    tabindex="0"
    @keydown.enter="inputRef?.click()"
    @keydown.space.prevent="inputRef?.click()"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="inputRef?.click()"
  >
    <input
      ref="inputRef"
      type="file"
      :accept="accept"
      class="sr-only"
      @change="onFileSelect"
    >
    <div class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-default ring ring-default">
      <UIcon name="i-lucide-upload" class="size-5 text-muted" />
    </div>
    <p class="text-sm text-toned">
      Drag and drop a file here, or
      <span class="text-primary font-medium">browse</span>
    </p>
    <p v-if="maxSize" class="text-xs text-muted mt-1.5 tabular-nums">
      Max size: {{ formatBytes(maxSize) }}
    </p>
    <p v-if="selectedFile" class="text-sm mt-3 font-medium text-highlighted tabular-nums">
      {{ selectedFile.name }} ({{ formatBytes(selectedFile.size) }})
    </p>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  accept?: string
  maxSize?: number
}>(), {
  accept: '*',
  maxSize: 50 * 1024 * 1024
})

const emit = defineEmits<{
  upload: [file: File]
}>()

const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

function onFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) processFile(file)
}

function processFile(file: File) {
  if (props.maxSize && file.size > props.maxSize) {
    return
  }
  selectedFile.value = file
  emit('upload', file)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
