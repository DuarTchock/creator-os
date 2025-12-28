'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'
import { useUserStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { 
  TrendingUp, 
  DollarSign, 
  MessageSquare, 
  Lightbulb,
  ArrowRight,
  Plus,
  Sparkles,
  Briefcase
} from 'lucide-react'

interface DashboardStats {
  totalDeals: number
  pipelineValue: number
  closedValue: number
  totalComments: number
  unprocessedComments: number
  totalClusters: number
}

export default function DashboardPage() {
  const { user } = useUserStore()
  const [stats, setStats] = useState<DashboardStats>({
    totalDeals: 0,
    pipelineValue: 0,
    closedValue: 0,
    totalComments: 0,
    unprocessedComments: 0,
    totalClusters: 0,
  })
  const [recentDeals, setRecentDeals] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      const supabase = createBrowserClient()
      
      // Fetch deals stats
      const { data: deals } = await supabase
        .from('deals')
        .select('status, amount')
      
      if (deals) {
        const pipelineValue = deals
          .filter(d => !['closed_won', 'closed_lost'].includes(d.status))
          .reduce((sum, d) => sum + (d.amount || 0), 0)
        
        const closedValue = deals
          .filter(d => d.status === 'closed_won')
          .reduce((sum, d) => sum + (d.amount || 0), 0)
        
        setStats(prev => ({
          ...prev,
          totalDeals: deals.length,
          pipelineValue,
          closedValue,
        }))
      }

      // Fetch recent deals
      const { data: recent } = await supabase
        .from('deals')
        .select('id, brand_name, status, amount, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (recent) {
        setRecentDeals(recent)
      }

      // Fetch comments stats
      const { count: totalComments } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
      
      const { count: unprocessedComments } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('is_processed', false)

      // Fetch clusters count
      const { count: totalClusters } = await supabase
        .from('clusters')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      setStats(prev => ({
        ...prev,
        totalComments: totalComments || 0,
        unprocessedComments: unprocessedComments || 0,
        totalClusters: totalClusters || 0,
      }))

      setIsLoading(false)
    }

    fetchDashboardData()
  }, [])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      lead: 'bg-blue-500',
      outreach: 'bg-yellow-500',
      negotiation: 'bg-purple-500',
      closed_won: 'bg-green-500',
      closed_lost: 'bg-red-500',
    }
    return colors[status] || 'bg-gray-500'
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          {getGreeting()}, {user?.full_name?.split(' ')[0] || 'Creator'}! 👋
        </h1>
        <p className="text-slate-400 mt-2">
          Here's what's happening with your creator business today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary-500/15 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-400" />
            </div>
            <span className="text-xs font-medium text-slate-500 bg-dark-tertiary px-2 py-1 rounded-full">
              Active
            </span>
          </div>
          <p className="text-3xl font-bold">{stats.totalDeals}</p>
          <p className="text-sm text-slate-400 mt-1">Total Deals</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-xs font-medium text-green-400 bg-green-500/15 px-2 py-1 rounded-full">
              Pipeline
            </span>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(stats.pipelineValue)}</p>
          <p className="text-sm text-slate-400 mt-1">Pipeline Value</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-xs font-medium text-purple-400 bg-purple-500/15 px-2 py-1 rounded-full">
              Inbox
            </span>
          </div>
          <p className="text-3xl font-bold">{stats.totalComments}</p>
          <p className="text-sm text-slate-400 mt-1">Comments Imported</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/15 flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-yellow-400" />
            </div>
            <span className="text-xs font-medium text-yellow-400 bg-yellow-500/15 px-2 py-1 rounded-full">
              AI
            </span>
          </div>
          <p className="text-3xl font-bold">{stats.totalClusters}</p>
          <p className="text-sm text-slate-400 mt-1">Insight Clusters</p>
        </div>
      </div>

      {/* Quick Actions & Recent Deals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link 
              href="/dashboard/deals?new=true"
              className="flex items-center gap-3 p-4 rounded-xl bg-dark-tertiary hover:bg-primary-500/15 hover:border-primary-500/30 border border-transparent transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center group-hover:bg-primary-500/30">
                <Plus className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="font-medium">Add New Deal</p>
                <p className="text-xs text-slate-500">Track a new brand opportunity</p>
              </div>
            </Link>
            
            <Link 
              href="/dashboard/inbox?upload=true"
              className="flex items-center gap-3 p-4 rounded-xl bg-dark-tertiary hover:bg-purple-500/15 hover:border-purple-500/30 border border-transparent transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="font-medium">Import Comments</p>
                <p className="text-xs text-slate-500">Upload from CSV</p>
              </div>
            </Link>
            
            <Link 
              href="/dashboard/insights?generate=true"
              className="flex items-center gap-3 p-4 rounded-xl bg-dark-tertiary hover:bg-yellow-500/15 hover:border-yellow-500/30 border border-transparent transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center group-hover:bg-yellow-500/30">
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="font-medium">Generate Insights</p>
                <p className="text-xs text-slate-500">AI-powered analysis</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Deals */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Deals</h2>
            <Link 
              href="/dashboard/deals"
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {recentDeals.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-dark-tertiary flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-4">No deals yet</p>
              <Link href="/dashboard/deals?new=true" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Your First Deal
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDeals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/dashboard/deals/${deal.id}`}
                  className="flex items-center justify-between p-4 rounded-xl bg-dark-tertiary hover:bg-dark-secondary transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(deal.status)}`} />
                    <div>
                      <p className="font-medium">{deal.brand_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{deal.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{deal.amount ? formatCurrency(deal.amount) : '—'}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(deal.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Getting Started Guide (show only if no data) */}
      {stats.totalDeals === 0 && stats.totalComments === 0 && (
        <div className="card p-8 border-primary-500/30 bg-gradient-to-br from-primary-500/5 to-transparent">
          <div className="flex items-start gap-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-7 h-7 text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Welcome to Creator OS! 🎉</h2>
              <p className="text-slate-400 mb-4">
                Let's get you set up. Here's how to make the most of your new creator business dashboard:
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary-500/30 flex items-center justify-center text-xs font-bold text-primary-300 flex-shrink-0">1</span>
                  <span><strong>Add your first deal</strong> — Track brand partnerships and sponsorship opportunities</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary-500/30 flex items-center justify-center text-xs font-bold text-primary-300 flex-shrink-0">2</span>
                  <span><strong>Import your comments</strong> — Upload DMs and comments from IG/YouTube via CSV</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary-500/30 flex items-center justify-center text-xs font-bold text-primary-300 flex-shrink-0">3</span>
                  <span><strong>Generate AI insights</strong> — Let our AI cluster common questions and suggest content ideas</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
