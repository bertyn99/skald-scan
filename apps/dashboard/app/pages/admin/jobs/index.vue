<template>
  <UPage>
    <UPageHeader title="Jobs" description="Recent queue jobs and sync failures." />
    <UPageBody>
      <div v-if="pending">
        <USkeleton class="h-64 w-full" />
      </div>
      <UAlert v-else-if="error" color="error" title="Failed to load jobs" />
      <div v-else class="space-y-6">
        <UCard variant="subtle">
          <template #header>
            <h2 class="font-semibold">Processed jobs</h2>
          </template>
          <UTable :data="jobs" :columns="jobColumns" />
        </UCard>
        <UCard v-if="syncErrors.length" variant="subtle">
          <template #header>
            <h2 class="font-semibold">Sync errors</h2>
          </template>
          <ul class="space-y-2 text-sm">
            <li v-for="item in syncErrors" :key="item.mangaId">
              <NuxtLink :to="`/admin/library/${item.mangaId}`" class="text-primary hover:underline">
                {{ item.mangaId }}
              </NuxtLink>
              — {{ item.lastError }}
            </li>
          </ul>
        </UCard>
      </div>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ layout: 'admin', middleware: 'admin' })

type JobRow = {
  jobId: string
  status: string
  metadata: string | null
  createdAt: number | null
}

const { data, pending, error } = await useFetch<{
  jobs: JobRow[]
  syncErrors: Array<{ mangaId: string; lastError: string | null }>
}>('/api/admin/jobs')

const jobs = computed(() => data.value?.jobs ?? [])
const syncErrors = computed(() => data.value?.syncErrors ?? [])

const jobColumns: TableColumn<JobRow>[] = [
  { accessorKey: 'jobId', header: 'Job ID' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'processedAt', header: 'Processed' }
]
</script>
