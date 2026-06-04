<template>
  <div class="min-h-screen flex flex-col bg-background text-foreground">
    <header class="border-b border-border sticky top-0 z-50 bg-background/75 backdrop-blur">
      <UContainer class="h-14 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <NuxtLink to="/admin/library" class="font-bold text-lg flex items-center gap-2 text-primary">
            <UIcon name="i-lucide-book-open" class="w-5 h-5" />
            Skald Scan
          </NuxtLink>
          <USeparator orientation="vertical" class="h-6" />
          <span class="text-sm text-muted-foreground">Dashboard</span>
        </div>

        <nav class="flex items-center gap-1">
          <UButton
            to="/admin/library"
            variant="ghost"
            color="neutral"
            icon="i-lucide-library"
            size="sm"
          >
            Library
          </UButton>
          <UButton
            to="/admin/mangadex"
            variant="ghost"
            color="neutral"
            icon="i-lucide-download"
            size="sm"
          >
            Import
          </UButton>
        </nav>
      </UContainer>
    </header>

    <main class="flex-1 flex flex-col">
      <slot />
    </main>
  </div>
</template>
