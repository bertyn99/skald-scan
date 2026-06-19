<template>
  <UPage>
    <UPageHeader
      title="Users"
      description="Manage who can read and who can administer the library."
    />

    <UPageBody class="space-y-6">
      <div v-if="pending" class="space-y-2">
        <USkeleton v-for="i in 5" :key="i" class="h-14 rounded-lg" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        title="Could not load users"
        description="The user list failed to load."
        :actions="[{ label: 'Retry', color: 'error', variant: 'outline', onClick: () => refresh() }]"
      />

      <UEmpty
        v-else-if="userList.length === 0"
        icon="i-lucide-users"
        title="No users yet"
        description="Accounts will appear here after people sign in."
        variant="subtle"
      />

      <UCard v-else variant="subtle" :ui="{ body: 'p-0 sm:p-0' }">
        <UTable
          :data="userList"
          :columns="columns"
          :loading="pending"
        />
      </UCard>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { h, resolveComponent } from 'vue'

definePageMeta({ layout: 'admin', middleware: 'admin' })

useHead({ title: 'Users — Skald Scan Dashboard' })

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  imageUrl: string | null
  createdAt: number | null
}

const UAvatar = resolveComponent('UAvatar')
const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UDropdownMenu = resolveComponent('UDropdownMenu')

const { data: response, pending, error, refresh } = await useFetch<{ users: UserRow[] }>('/api/admin/users')

const userList = computed(() => response.value?.users ?? [])

const columns: TableColumn<UserRow>[] = [
  {
    accessorKey: 'name',
    header: 'User',
    cell: ({ row }) => h('div', { class: 'flex items-center gap-2' }, [
      h(UAvatar, { src: row.original.imageUrl ?? undefined, alt: row.original.name ?? '', size: 'sm' }),
      h('span', { class: 'font-medium' }, row.original.name ?? 'Unnamed')
    ])
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => h('span', { class: 'text-muted' }, row.original.email)
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => h(UBadge, {
      color: row.original.role === 'admin' ? 'primary' : 'neutral',
      variant: 'subtle',
      size: 'xs'
    }, () => row.original.role)
  },
  {
    accessorKey: 'createdAt',
    header: 'Joined',
    cell: ({ row }) => h('span', { class: 'text-muted tabular-nums' }, formatDate(row.original.createdAt))
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => h(UDropdownMenu, {
      items: roleItems(row.original),
      onSelect: (item: { value?: string }) => {
        if (item.value) changeRole(row.original.id, item.value)
      }
    }, () => h(UButton, { variant: 'ghost', size: 'xs', icon: 'i-lucide-more-horizontal', 'aria-label': 'Change role' }))
  }
]

function roleItems(user: UserRow) {
  return [
    { label: 'Admin', value: 'admin', disabled: user.role === 'admin' },
    { label: 'Reader', value: 'reader', disabled: user.role === 'reader' }
  ]
}

async function changeRole(userId: string, role: string) {
  try {
    await $fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: { role }
    })
    await refresh()
  } catch (err) {
    console.error('Failed to change role:', err)
  }
}

function formatDate(ts: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>
