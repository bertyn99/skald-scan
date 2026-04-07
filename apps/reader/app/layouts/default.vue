<template>
  <div class="min-h-screen flex flex-col bg-background text-foreground">
    <!-- Basic header using Nuxt UI components -->
    <header class="border-b border-border sticky top-0 z-50 bg-background/75 backdrop-blur">
      <UContainer class="h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <NuxtLink to="/" class="font-bold text-xl flex items-center gap-2 text-primary">
            <UIcon name="i-lucide-book-open" class="w-6 h-6" />
            Skald Scan
          </NuxtLink>
        </div>
        
        <nav class="flex items-center gap-2">
          <UButton to="/library" variant="ghost" color="neutral" icon="i-lucide-library">
            Library
          </UButton>
          <UButton to="/search" variant="ghost" color="neutral" icon="i-lucide-search">
            Search
          </UButton>
          <UButton variant="ghost" color="neutral" icon="i-lucide-settings" square />
        </nav>
      </UContainer>
    </header>

    <main class="flex-1 flex flex-col">
      <slot />
    </main>

    <footer class="border-t border-border py-6 mt-auto">
      <UContainer class="flex justify-between items-center text-sm text-muted">
        <div>
          &copy; {{ new Date().getFullYear() }} Skald Scan
        </div>
        <div class="flex items-center gap-4">
          <NuxtLink to="/about" class="hover:text-foreground transition-colors">About</NuxtLink>
        </div>
      </UContainer>
    </footer>
  </div>
</template>
