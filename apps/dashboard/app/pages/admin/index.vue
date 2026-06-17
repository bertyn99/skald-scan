<template>
  <UPage>
    <UPageHeader
      title="Dashboard"
      description="Library overview and shortcuts for common admin tasks."
    />

    <UPageBody class="space-y-8">
      <div v-if="pending" class="rounded-lg ring ring-default bg-elevated/30 p-1">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
          <USkeleton v-for="i in 3" :key="i" class="h-16 rounded-md" />
        </div>
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        title="Could not load stats"
        description="The overview metrics are unavailable right now."
        :actions="[{ label: 'Retry', color: 'error', variant: 'outline', onClick: () => refresh() }]"
      />

      <UCard
        v-else-if="stats"
        variant="subtle"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <div class="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-default">
          <div
            v-for="item in statItems"
            :key="item.label"
            class="flex items-center gap-3 px-5 py-4"
          >
            <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <UIcon :name="item.icon" class="size-4 text-primary" />
            </div>
            <div class="min-w-0">
              <p class="text-sm text-muted tabular-nums">
                {{ item.value }}
                <span class="text-toned font-medium">{{ item.label }}</span>
              </p>
            </div>
          </div>
        </div>
      </UCard>

      <section class="space-y-4">
        <div>
          <h2 class="text-base font-semibold text-highlighted">Quick actions</h2>
          <p class="text-sm text-muted mt-0.5">Jump straight into the workflows you use most.</p>
        </div>
        <UPageGrid class="lg:grid-cols-3">
          <UPageCard
            variant="subtle"
            title="Upload manga"
            description="Add a title manually with cover art and chapter archives."
            icon="i-lucide-upload"
            to="/admin/upload"
          />
          <UPageCard
            variant="subtle"
            title="Import from MangaDex"
            description="Pull metadata and chapters from a MangaDex series ID."
            icon="i-lucide-download"
            to="/admin/mangadex"
          />
          <UPageCard
            variant="subtle"
            title="Manage users"
            description="Review accounts and adjust reader or admin roles."
            icon="i-lucide-users"
            to="/admin/users"
          />
        </UPageGrid>
      </section>

      <section class="space-y-4">
        <div>
          <h2 class="text-base font-semibold text-highlighted">Library</h2>
          <p class="text-sm text-muted mt-0.5">Browse and edit titles already in your collection.</p>
        </div>
        <UPageCard
          variant="subtle"
          title="Browse library"
          description="Search, filter, and open manga to manage chapters."
          icon="i-lucide-library"
          to="/admin/library"
          class="max-w-md"
        />
      </section>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

useHead({ title: 'Dashboard — Skald Scan' })

const { data: stats, pending, error, refresh } = await useFetch<{
  totalManga: number
  totalChapters: number
  totalUsers: number
}>('/api/admin/stats')

const statItems = computed(() => {
  if (!stats.value) return []
  return [
    { label: 'manga', value: stats.value.totalManga, icon: 'i-lucide-book-open' },
    { label: 'chapters', value: stats.value.totalChapters, icon: 'i-lucide-list' },
    { label: 'users', value: stats.value.totalUsers, icon: 'i-lucide-users' }
  ]
})
</script>
