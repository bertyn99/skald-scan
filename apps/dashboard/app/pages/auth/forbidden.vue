<template>
  <UContainer class="py-16 max-w-md mx-auto text-center space-y-4">
    <UIcon name="i-lucide-shield-alert" class="size-12 text-warning mx-auto" />
    <h1 class="text-xl font-semibold">Access denied</h1>
    <p class="text-muted">This console is for admin accounts only.</p>
    <UButton to="/auth/sign-in" color="primary">
      Sign in with admin account
    </UButton>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
</script>
