<template>
  <UContainer class="py-16 max-w-md mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-xl font-semibold">Sign in</h1>
      </template>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Email" required>
          <UInput v-model="email" type="email" />
        </UFormField>
        <UFormField label="Password" required>
          <UInput v-model="password" type="password" />
        </UFormField>
        <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
        <UButton type="submit" block :loading="loading">Sign in</UButton>
        <p class="text-sm text-center text-muted">
          No account?
          <NuxtLink to="/auth/sign-up" class="text-primary">Sign up</NuxtLink>
        </p>
      </form>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
const { signIn } = useAuthSession()
const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function submit() {
  loading.value = true
  errorMessage.value = ''
  try {
    await signIn(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/library'
    await navigateTo(redirect)
  } catch (err) {
    errorMessage.value = (err as Error).message
  } finally {
    loading.value = false
  }
}
</script>
