<template>
  <div
    ref="container"
    class="w-full"
    :style="{ aspectRatio: loaded ? undefined : '3/4' }"
  >
    <img
      v-if="inViewport"
      :src="src"
      :alt="`Page ${pageNumber}`"
      class="w-full h-auto block"
      loading="lazy"
      decoding="async"
      @load="loaded = true"
      @error="loaded = true"
    />
    <div
      v-else
      class="w-full h-full flex items-center justify-center bg-neutral-900"
    >
      <span class="text-neutral-600 text-sm font-mono">{{ pageNumber }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  src: string
  pageNumber: number
  totalPages: number
}>()

const emit = defineEmits<{
  visible: [page: number]
}>()

const container = ref<HTMLElement | null>(null)
const loaded = ref(false)
const inViewport = ref(false)

let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!container.value) return

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          inViewport.value = true
          emit('visible', props.pageNumber)
        } else if (!entry.isIntersecting && Math.abs(entry.boundingClientRect.top) > window.innerHeight * 3) {
          // Unload distant images to save memory (A25: cap at ~50 concurrent)
          inViewport.value = false
        }
      }
    },
    {
      rootMargin: '200% 0px',
      threshold: 0.1,
    }
  )

  observer.observe(container.value)
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>
