<template>
  <UContainer class="py-8 space-y-6">
    <h1 class="text-2xl font-bold">Dashboard</h1>

    <div v-if="pending" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <USkeleton v-for="i in 3" :key="i" class="h-28 rounded-lg" />
    </div>

    <div v-else-if="error" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
      <p>Failed to load stats.</p>
      <UButton variant="outline" class="mt-4" @click="refresh">Retry</UButton>
    </div>

    <template v-else-if="stats">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UCard>
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10">
              <UIcon name="i-lucide-book-open" class="w-5 h-5 text-primary" />
            </div>
            <div>
              <p class="text-2xl font-bold">{{ stats.totalManga }}</p>
              <p class="text-xs text-muted-foreground">Total Manga</p>
            </div>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10">
              <UIcon name="i-lucide-list" class="w-5 h-5 text-primary" />
            </div>
            <div>
              <p class="text-2xl font-bold">{{ stats.totalChapters }}</p>
              <p class="text-xs text-muted-foreground">Total Chapters</p>
            </div>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10">
              <UIcon name="i-lucide-users" class="w-5 h-5 text-primary" />
            </div>
            <div>
              <p class="text-2xl font-bold">{{ stats.totalUsers }}</p>
              <p class="text-xs text-muted-foreground">Users</p>
            </div>
          </div>
        </UCard>
      </div>
    </template>

    <USeparator />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <UCard>
        <template #header>
          <h3 class="font-semibold">Quick Actions</h3>
        </template>
        <div class="space-y-2">
          <UButton to="/admin/upload" variant="outline" color="neutral" icon="i-lucide-upload" block>
            Upload Manga
          </UButton>
          <UButton to="/admin/mangadex" variant="outline" color="neutral" icon="i-lucide-download" block>
            Import from MangaDex
          </UButton>
          <UButton to="/admin/users" variant="outline" color="neutral" icon="i-lucide-users" block>
            Manage Users
          </UButton>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="font-semibold">Recent Library</h3>
        </template>
        <UButton to="/admin/library" variant="outline" color="neutral" icon="i-lucide-library" block>
          Browse Library
        </UButton>
      </UCard>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

useHead({ title: 'Dashboard — Skald Scan' })

const { data: stats, pending, error, refresh } = await useFetch<{
  totalManga: number
  totalChapters: number
  totalUsers: number
}>('/api/admin/stats')
</script>
