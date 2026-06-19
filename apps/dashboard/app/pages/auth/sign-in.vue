<template>
  <UContainer class="py-16 max-w-md mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-xl font-semibold">Admin sign in</h1>
        <p class="text-sm text-muted mt-1">Skald Scan operations console</p>
      </template>

      <form class="space-y-4" @submit.prevent="signIn">
        <UFormField label="Email" required>
          <UInput v-model="email" type="email" autocomplete="email" />
        </UFormField>
        <UFormField label="Password" required>
          <UInput v-model="password" type="password" autocomplete="current-password" />
        </UFormField>
        <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
        <UButton type="submit" color="primary" block :loading="loading">
          Sign in
        </UButton>
      </form>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'guest' })

const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function signIn() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await authClient.signIn.email({
      email: email.value,
      password: password.value
    })
    if (result.error) {
      errorMessage.value = result.error.message ?? 'Sign in failed'
      return
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
    await navigateTo(redirect)
  } catch (err) {
    errorMessage.value = (err as Error).message
  } finally {
    loading.value = false
  }
}
</script>
