<template>
  <UPage>
    <UPageHeader title="Settings" description="Deployment and health configuration." />
    <UPageBody class="space-y-6">
      <UCard variant="subtle">
        <div class="space-y-3 text-sm">
          <div class="flex justify-between">
            <span class="text-muted">Sync interval</span>
            <span>30 minutes (env: SYNC_INTERVAL_MINUTES — read-only)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted">Cron batch size</span>
            <span>5 manga per run</span>
          </div>
        </div>
      </UCard>

      <UCard variant="subtle">
        <template #header>
          <h2 class="font-semibold">Health</h2>
        </template>
        <div v-if="healthPending">Loading...</div>
        <pre v-else class="text-xs overflow-auto">{{ health }}</pre>
      </UCard>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { data: health, pending: healthPending } = await useFetch('/api/admin/health')
</script>
