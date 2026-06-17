import type { NavigationMenuItem } from '@nuxt/ui'

export function useAdminNav() {
  const route = useRoute()

  const mainItems = computed<NavigationMenuItem[]>(() => [
    {
      label: 'Overview',
      icon: 'i-lucide-layout-dashboard',
      to: '/admin',
      active: route.path === '/admin'
    },
    {
      label: 'Library',
      icon: 'i-lucide-library',
      to: '/admin/library',
      active: route.path.startsWith('/admin/library')
    },
    {
      label: 'Upload',
      icon: 'i-lucide-upload',
      to: '/admin/upload',
      active: route.path === '/admin/upload'
    },
    {
      label: 'Import',
      icon: 'i-lucide-download',
      to: '/admin/mangadex',
      active: route.path.startsWith('/admin/mangadex')
    },
    {
      label: 'Users',
      icon: 'i-lucide-users',
      to: '/admin/users',
      active: route.path.startsWith('/admin/users')
    }
  ])

  return { mainItems }
}
