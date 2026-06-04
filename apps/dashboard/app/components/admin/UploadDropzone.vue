<template>
  <div
    class="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
    :class="{ 'border-primary bg-primary/5': isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="inputRef?.click()"
  >
    <input
      ref="inputRef"
      type="file"
      :accept="accept"
      class="hidden"
      @change="onFileSelect"
    >
    <UIcon name="i-lucide-upload" class="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
    <p class="text-sm text-muted-foreground">
      Drag and drop a file here, or <span class="text-primary underline">browse</span>
    </p>
    <p v-if="maxSize" class="text-xs text-muted-foreground mt-1">
      Max size: {{ formatBytes(maxSize) }}
    </p>
    <p v-if="selectedFile" class="text-sm mt-3 text-foreground">
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
  maxSize: 50 * 1024 * 1024,
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
