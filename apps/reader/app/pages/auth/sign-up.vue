<template>
  <UContainer class="py-16 max-w-md mx-auto">
    <UCard>
      <template #header>
        <h1 class="text-xl font-semibold">Create account</h1>
      </template>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Name">
          <UInput v-model="name" />
        </UFormField>
        <UFormField label="Email" required>
          <UInput v-model="email" type="email" />
        </UFormField>
        <UFormField label="Password" required>
          <UInput v-model="password" type="password" />
        </UFormField>
        <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" />
        <UButton type="submit" block :loading="loading">Sign up</UButton>
        <p class="text-sm text-center text-muted">
          Already have an account?
          <NuxtLink to="/auth/sign-in" class="text-primary">Sign in</NuxtLink>
        </p>
      </form>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
const { signUp } = useAuthSession()
const email = ref('')
const password = ref('')
const name = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function submit() {
  loading.value = true
  errorMessage.value = ''
  try {
    await signUp(email.value, password.value, name.value || undefined)
    await navigateTo('/library')
  } catch (err) {
    errorMessage.value = (err as Error).message
  } finally {
    loading.value = false
  }
}
</script>
