'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { useUserStore } from '@/lib/store'
import { 
  LayoutDashboard, 
  Briefcase, 
  MessageSquare, 
  Lightbulb,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import PaywallModal from '@/components/PaywallModal'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Brand Deals', href: '/dashboard/deals', icon: Briefcase },
  { name: 'Inbox Brain', href: '/dashboard/inbox', icon: MessageSquare },
  { name: 'Insights', href: '/dashboard/insights', icon: Lightbulb },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, setUser, setLoading } = useUserStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [trialStatus, setTrialStatus] = useState<any>(null)
  const [showPaywall, setShowPaywall] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createBrowserClient()
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/auth/login')
        return
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      setUser({
        id: session.user.id,
        email: session.user.email!,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        subscription_tier: profile?.subscription_tier || 'free',
      })

      // Check trial status
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/stripe/trial-status`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setTrialStatus(data)
          
          // Show paywall if trial expired and no subscription
          if (!data.has_access) {
            setShowPaywall(true)
          }
        }
      } catch (error) {
        console.error('Error checking trial status:', error)
      }
      
      setIsLoading(false)
    }

    checkAuth()
  }, [router, setUser])

  const handleLogout = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-dark-card border-r border-dark-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-dark-border">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-primary-500/25">
                C
              </div>
              <span className="text-xl font-bold gradient-text">Creator OS</span>
            </Link>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Trial Banner */}
          {trialStatus && trialStatus.reason === 'free_trial' && (
            <div className="mx-4 mt-4 p-3 bg-primary-500/20 rounded-xl border border-primary-500/30">
              <p className="text-primary-300 text-sm font-medium">
                ⏰ {trialStatus.trial_days_left} days left in trial
              </p>
              <Link href="/pricing" className="text-primary-400 text-xs hover:underline">
                Upgrade now →
              </Link>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
                    isActive 
                      ? "bg-primary-500/15 text-primary-400 border border-primary-500/30" 
                      : "text-slate-400 hover:text-white hover:bg-dark-tertiary"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-dark-border">
            <div className="flex items-center gap-3 mb-4 px-4">
              <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-semibold">
                {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-dark-card/80 backdrop-blur-sm border-b border-dark-border">
          <div className="flex items-center justify-between px-4 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-400 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center font-bold text-sm">
                C
              </div>
              <span className="font-bold gradient-text">Creator OS</span>
            </div>
            <div className="w-6" /> {/* Spacer */}
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        daysLeft={trialStatus?.trial_days_left}
        onClose={() => setShowPaywall(false)}
      />
    </div>
  )
}
