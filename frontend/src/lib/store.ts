import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// User store
interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  subscription_tier: 'free' | 'pro' | 'agency'
}

interface UserStore {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'creator-os-user',
    }
  )
)

// Deals store
interface Deal {
  id: string
  brand_name: string
  brand_email: string | null
  status: string
  amount: number | null
  currency: string
  category: string | null
  source: string
  created_at: string
}

interface DealsStore {
  deals: Deal[]
  isLoading: boolean
  setDeals: (deals: Deal[]) => void
  addDeal: (deal: Deal) => void
  updateDeal: (id: string, updates: Partial<Deal>) => void
  removeDeal: (id: string) => void
  setLoading: (loading: boolean) => void
}

export const useDealsStore = create<DealsStore>((set) => ({
  deals: [],
  isLoading: true,
  setDeals: (deals) => set({ deals, isLoading: false }),
  addDeal: (deal) => set((state) => ({ deals: [deal, ...state.deals] })),
  updateDeal: (id, updates) =>
    set((state) => ({
      deals: state.deals.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),
  removeDeal: (id) =>
    set((state) => ({
      deals: state.deals.filter((d) => d.id !== id),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}))

// UI store
interface UIStore {
  sidebarOpen: boolean
  modalOpen: string | null
  toggleSidebar: () => void
  openModal: (modalId: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  modalOpen: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  openModal: (modalId) => set({ modalOpen: modalId }),
  closeModal: () => set({ modalOpen: null }),
}))
