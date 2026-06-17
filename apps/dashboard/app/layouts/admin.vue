<script setup lang="ts">
const { mainItems } = useAdminNav()
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="admin-sidebar"
      collapsible
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          to="/admin"
          class="flex items-center gap-2 font-semibold text-highlighted min-w-0"
          :class="collapsed ? 'justify-center w-full' : ''"
        >
          <UIcon name="i-lucide-book-open" class="size-5 shrink-0 text-primary" />
          <span v-if="!collapsed" class="truncate">Skald Scan</span>
        </NuxtLink>
      </template>

      <UNavigationMenu
        :items="mainItems"
        orientation="vertical"
      />
    </UDashboardSidebar>

    <UDashboardPanel id="admin-main">
      <template #header>
        <UDashboardNavbar>
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
