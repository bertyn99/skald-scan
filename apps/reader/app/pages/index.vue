<template>
  <UContainer class="py-16 text-center max-w-3xl mx-auto space-y-8">
    <div class="space-y-4">
      <UIcon name="i-lucide-book-open" class="w-16 h-16 text-primary mx-auto mb-6" />
      <h1 class="text-4xl md:text-5xl font-bold tracking-tight">Welcome to Skald Scan</h1>
      <p class="text-xl text-muted-foreground max-w-2xl mx-auto">
        Your next generation, self-hosted manga reader. High performance, native feeling, and completely offline capable.
      </p>
    </div>

    <div class="flex items-center justify-center gap-4 pt-8">
      <UButton size="xl" color="primary" to="/library" icon="i-lucide-library">
        Go to Library
      </UButton>
      <UButton size="xl" variant="outline" color="neutral" to="/search" icon="i-lucide-search">
        Search Manga
      </UButton>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
useHead({
  title: 'Skald Scan - Home'
})
</script>
