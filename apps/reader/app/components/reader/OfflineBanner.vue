<template>
  <Transition name="slide-down">
    <div
      v-if="!isOnline"
      class="fixed top-0 left-0 right-0 z-[100] bg-amber-600 text-white text-center text-sm py-2 px-4"
    >
      You are offline — cached pages are still available
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { isOnline } = useOfflineCache()
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.3s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
}
</style>
