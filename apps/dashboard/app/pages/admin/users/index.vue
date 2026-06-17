<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Users</h1>
    </div>

    <div v-if="pending" class="space-y-3">
      <USkeleton v-for="i in 5" :key="i" class="h-12 rounded-lg" />
    </div>

    <div v-else-if="error" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-alert-circle" class="w-12 h-12 mx-auto mb-4 text-error" />
      <p>Failed to load users.</p>
      <UButton variant="outline" class="mt-4" @click="() => refresh()">Retry</UButton>
    </div>

    <div v-else-if="userList.length === 0" class="text-center py-16 text-muted-foreground">
      <UIcon name="i-lucide-users" class="w-12 h-12 mx-auto mb-4" />
      <p>No users found.</p>
    </div>

    <div v-else class="border border-border rounded-lg overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="text-left px-4 py-2 font-medium">User</th>
            <th class="text-left px-4 py-2 font-medium">Email</th>
            <th class="text-left px-4 py-2 font-medium">Role</th>
            <th class="text-left px-4 py-2 font-medium">Joined</th>
            <th class="text-left px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in userList"
            :key="user.id"
            class="border-t border-border hover:bg-muted/30 transition-colors"
          >
            <td class="px-4 py-2">
              <div class="flex items-center gap-2">
                <UAvatar :src="user.imageUrl ?? undefined" :alt="user.name ?? ''" size="sm" />
                <span class="font-medium">{{ user.name ?? 'Unnamed' }}</span>
              </div>
            </td>
            <td class="px-4 py-2 text-muted-foreground">{{ user.email }}</td>
            <td class="px-4 py-2">
              <UBadge :color="user.role === 'admin' ? 'primary' : 'neutral'" variant="subtle" size="xs">
                {{ user.role }}
              </UBadge>
            </td>
            <td class="px-4 py-2 text-muted-foreground">{{ formatDate(user.createdAt) }}</td>
            <td class="px-4 py-2">
              <UDropdownMenu
                :items="roleItems(user)"
                @select="(item: any) => changeRole(user.id, item.value)"
              >
                <UButton variant="ghost" size="xs" icon="i-lucide-more-horizontal" />
              </UDropdownMenu>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

useHead({ title: 'Users — Skald Scan Dashboard' })

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  imageUrl: string | null
  createdAt: number | null
}

const { data: response, pending, error, refresh } = await useFetch<{ users: UserRow[] }>('/api/admin/users')

const userList = computed(() => response.value?.users ?? [])

function roleItems(user: UserRow) {
  return [
    { label: 'Admin', value: 'admin', disabled: user.role === 'admin' },
    { label: 'Reader', value: 'reader', disabled: user.role === 'reader' },
  ]
}

async function changeRole(userId: string, role: string) {
  try {
    await $fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: { role },
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
