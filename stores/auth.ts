import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as any,
    initialized: false,
    loading: false
  }),
  getters: {
    can: (state) => (permission: string) => state.user?.role === 'ADMIN' || (state.user?.permissions || []).includes(permission)
  },
  actions: {
    async fetchUser() {
      if (this.loading) return
      this.loading = true
      try {
        const headers = process.server ? useRequestHeaders(['cookie']) : undefined
        const r: any = await $fetch('/api/auth/me', {
          headers,
          credentials: 'include'
        }).catch(() => ({ user: null }))
        this.user = r?.user || null
      } finally {
        this.initialized = true
        this.loading = false
      }
    },
    async login(username: string, password: string) {
      const r: any = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { username, password },
        credentials: 'include'
      })
      this.user = r.user
      this.initialized = true
    },
    async refresh() {
      this.initialized = false
      await this.fetchUser()
    }
  }
})
