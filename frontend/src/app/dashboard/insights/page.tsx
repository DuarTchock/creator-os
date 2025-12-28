'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { 
  Sparkles, 
  Lightbulb,
  MessageSquare,
  TrendingUp,
  Loader2,
  RefreshCw,
  ChevronRight,
  Upload,
  X,
  Filter,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import PaywallModal from '@/components/PaywallModal'
import ConfirmModal from '@/components/ConfirmModal'

interface ClusterWithStats {
  id: string
  theme: string
  summary: string | null
  sample_comments: string[]
  content_ideas: Array<{
    title: string
    description: string
    content_type: string
  }>
  created_at: string
  total_comment_count: number
  platform_breakdown: Record<string, number>
  filtered_comment_count: number
  platforms: string[]
  import_ids: string[]
}

interface Import {
  id: string
  name: string
  platform: string
  comment_count: number
}

interface ClustersMeta {
  total_clusters: number
  filter_applied: {
    platform: string | null
    import_id: string | null
  }
  available_platforms: string[]
  available_imports: Import[]
}

interface CommentStats {
  total: number
  unprocessed: number
}

export default function InsightsPage() {
  const [clusters, setClusters] = useState<ClusterWithStats[]>([])
  const [meta, setMeta] = useState<ClustersMeta | null>(null)
  const [stats, setStats] = useState<CommentStats>({ total: 0, unprocessed: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<ClusterWithStats | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showNoCommentsModal, setShowNoCommentsModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  
  // Filters
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedImport, setSelectedImport] = useState<string>('all')

  const fetchClusters = useCallback(async () => {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        setIsLoading(false)
        return
      }

      // Build query params
      const params = new URLSearchParams()
      if (selectedPlatform !== 'all') {
        params.append('platform', selectedPlatform)
      }
      if (selectedImport !== 'all') {
        params.append('import_id', selectedImport)
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/ai/clusters-with-stats${params.toString() ? '?' + params.toString() : ''}`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setClusters(data.clusters || [])
        setMeta(data.meta || null)
      } else {
        console.error('Failed to fetch clusters:', response.status)
        setClusters([])
      }
    } catch (error) {
      console.error('Error fetching clusters:', error)
      setClusters([])
    }
  }, [selectedPlatform, selectedImport])

  const fetchCommentStats = useCallback(async () => {
    const supabase = createBrowserClient()

    const { count: total } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })

    const { count: unprocessed } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('is_processed', false)

    setStats({
      total: total || 0,
      unprocessed: unprocessed || 0
    })
  }, [])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([fetchClusters(), fetchCommentStats()])
    setIsLoading(false)
  }, [fetchClusters, fetchCommentStats])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Refetch clusters when filters change
  useEffect(() => {
    if (!isLoading) {
      fetchClusters()
    }
  }, [selectedPlatform, selectedImport])

  const handleGenerateInsights = async () => {
    if (stats.unprocessed < 3) {
      setShowNoCommentsModal(true)
      return
    }

    setIsGenerating(true)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/ai/cluster-comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          num_clusters: Math.min(Math.max(Math.floor(stats.unprocessed / 3), 3), 10),
          min_cluster_size: 2
        })
      })

      if (response.status === 402) {
        setShowPaywall(true)
        setIsGenerating(false)
        return
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to generate insights')
      }

      const data = await response.json()
      toast.success(`Generated ${data.clusters_created} insight clusters!`)
      
      // Reset filters and refetch
      setSelectedPlatform('all')
      setSelectedImport('all')
      fetchData()
    } catch (error) {
      toast.error('Failed to generate insights. Make sure the backend is running.')
      console.error(error)
    }

    setIsGenerating(false)
  }

  const handleResetInsights = async () => {
    setIsResetting(true)

    try {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error('Not authenticated')
        setIsResetting(false)
        setShowResetModal(false)
        return
      }

      const { error } = await supabase
        .from('clusters')
        .update({ is_active: false })
        .eq('user_id', user.id)

      if (error) {
        toast.error('Failed to reset insights')
      } else {
        await supabase
          .from('comments')
          .update({ is_processed: false, cluster_id: null })
          .eq('user_id', user.id)

        toast.success('Insights reset! You can now regenerate them.')
        setClusters([])
        setSelectedPlatform('all')
        setSelectedImport('all')
        fetchData()
      }
    } catch (error) {
      toast.error('Failed to reset insights')
    }

    setIsResetting(false)
    setShowResetModal(false)
  }

  const clearFilters = () => {
    setSelectedPlatform('all')
    setSelectedImport('all')
  }

  const hasActiveFilters = selectedPlatform !== 'all' || selectedImport !== 'all'

  // Get platform display info
  const getPlatformStyle = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return 'bg-red-500/15 text-red-400'
      case 'instagram':
        return 'bg-pink-500/15 text-pink-400'
      case 'tiktok':
        return 'bg-cyan-500/15 text-cyan-400'
      default:
        return 'bg-slate-500/15 text-slate-400'
    }
  }

  // Calculate total comments for current filter from meta
  const getFilteredCommentCount = () => {
    if (!meta) return 0
    return clusters.reduce((sum, c) => sum + c.filtered_comment_count, 0)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">AI Insights</h1>
          <p className="text-slate-400 text-sm mt-1">
            Discover patterns in your audience feedback
          </p>
        </div>
        <div className="flex items-center gap-2">
          {clusters.length > 0 && (
            <button
              onClick={() => setShowResetModal(true)}
              disabled={isResetting}
              className="btn-secondary flex items-center gap-2"
              title="Reset all insights"
            >
              {isResetting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          <button
            onClick={handleGenerateInsights}
            disabled={isGenerating}
            className="btn-primary flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Insights
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-slate-500">Total Comments</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/15 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.unprocessed}</p>
              <p className="text-xs text-slate-500">Unprocessed</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{meta?.total_clusters || 0}</p>
              <p className="text-xs text-slate-500">
                {hasActiveFilters ? 'Matching Clusters' : 'Insight Clusters'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {meta && (meta.available_platforms.length > 0 || meta.available_imports.length > 0) && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Filters:</span>
            </div>

            {meta.available_platforms.length > 0 && (
              <div>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="input text-sm py-1.5"
                >
                  <option value="all">All Platforms</option>
                  {meta.available_platforms.map(platform => (
                    <option key={platform} value={platform}>
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {meta.available_imports.length > 0 && (
              <div>
                <select
                  value={selectedImport}
                  onChange={(e) => setSelectedImport(e.target.value)}
                  className="input text-sm py-1.5"
                >
                  <option value="all">All Imports</option>
                  {meta.available_imports.map(imp => (
                    <option key={imp.id} value={imp.id}>
                      {imp.name} ({imp.comment_count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Clear filters
              </button>
            )}

            {hasActiveFilters && (
              <span className="text-xs text-slate-500">
                {getFilteredCommentCount()} comments in {clusters.length} clusters
              </span>
            )}
          </div>
        </div>
      )}

      {/* Clusters */}
      {clusters.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-dark-tertiary flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            {hasActiveFilters 
              ? 'No insights match your filters' 
              : 'No insights yet'}
          </h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your filters or generate new insights.'
              : 'Import some comments in the Inbox Brain section, then click "Generate Insights" to let AI analyze and cluster your audience feedback.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {clusters.map((cluster) => (
            <div
              key={cluster.id}
              className="card p-6 hover:border-primary-500/30 transition-all cursor-pointer"
              onClick={() => setSelectedCluster(cluster)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-500/15 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{cluster.theme}</h3>
                    <p className="text-xs text-slate-500">
                      {cluster.filtered_comment_count} comment{cluster.filtered_comment_count !== 1 ? 's' : ''}
                      {hasActiveFilters && cluster.total_comment_count !== cluster.filtered_comment_count && (
                        <span className="text-slate-600"> (of {cluster.total_comment_count} total)</span>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </div>

              {cluster.summary && (
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                  {cluster.summary}
                </p>
              )}

              {cluster.platforms && cluster.platforms.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {cluster.platforms.map((platform, i) => (
                    <span 
                      key={i} 
                      className={`text-xs px-2 py-0.5 rounded ${getPlatformStyle(platform)}`}
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              )}

              {cluster.content_ideas && cluster.content_ideas.length > 0 && (
                <div className="pt-4 border-t border-dark-border">
                  <p className="text-xs text-slate-500 mb-2">Content Ideas:</p>
                  <div className="flex flex-wrap gap-2">
                    {cluster.content_ideas.slice(0, 2).map((idea, i) => (
                      <span key={i} className="text-xs bg-primary-500/15 text-primary-300 px-2 py-1 rounded">
                        {idea.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cluster Detail Modal */}
      {selectedCluster && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-in">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">{selectedCluster.theme}</h2>
                <p className="text-sm text-slate-500">
                  {selectedCluster.filtered_comment_count} comment{selectedCluster.filtered_comment_count !== 1 ? 's' : ''} in this cluster
                  {hasActiveFilters && selectedCluster.total_comment_count !== selectedCluster.filtered_comment_count && (
                    <span> ({selectedCluster.total_comment_count} total)</span>
                  )}
                </p>
                {selectedCluster.platforms && selectedCluster.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedCluster.platforms.map((platform, i) => (
                      <span 
                        key={i} 
                        className={`text-xs px-2 py-0.5 rounded ${getPlatformStyle(platform)}`}
                      >
                        {platform}
                      </span>
                    ))}
                  </div>
                )}
                {/* Platform breakdown when no filter */}
                {!hasActiveFilters && Object.keys(selectedCluster.platform_breakdown).length > 1 && (
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                    {Object.entries(selectedCluster.platform_breakdown).map(([plat, count]) => (
                      <span key={plat}>{plat}: {count}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {selectedCluster.summary && (
              <div className="mb-6">
                <h3 className="font-medium mb-2">Summary</h3>
                <p className="text-slate-400">{selectedCluster.summary}</p>
              </div>
            )}

            {selectedCluster.sample_comments && selectedCluster.sample_comments.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium mb-3">Sample Comments</h3>
                <div className="space-y-2">
                  {selectedCluster.sample_comments.map((comment, i) => (
                    <div key={i} className="p-3 bg-dark-tertiary rounded-lg text-sm text-slate-300">
                      "{comment}"
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCluster.content_ideas && selectedCluster.content_ideas.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Content Ideas</h3>
                <div className="space-y-3">
                  {selectedCluster.content_ideas.map((idea, i) => (
                    <div key={i} className="p-4 bg-dark-tertiary rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="w-4 h-4 text-yellow-400" />
                        <span className="font-medium">{idea.title}</span>
                        <span className="text-xs text-slate-500 bg-dark-bg px-2 py-0.5 rounded">
                          {idea.content_type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400">{idea.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Comments Modal */}
      {showNoCommentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md animate-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">No New Comments</h2>
              <button
                onClick={() => setShowNoCommentsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/15 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-yellow-400" />
              </div>
              <p className="text-slate-400 mb-6">
                {stats.unprocessed === 0 
                  ? "All comments have been analyzed. Import new comments to generate fresh insights."
                  : `You have ${stats.unprocessed} unprocessed comment${stats.unprocessed === 1 ? '' : 's'}. Need at least 3 to generate meaningful insights.`
                }
              </p>
              
              <div className="flex flex-col gap-3">
                <Link
                  href="/dashboard/inbox"
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Go to Inbox Brain
                </Link>
                <button
                  onClick={() => setShowNoCommentsModal(false)}
                  className="btn-secondary w-full"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showResetModal}
        title="Reset All Insights"
        message={
          <div className="space-y-2">
            <p>This will delete all insight clusters and allow you to regenerate them from your comments.</p>
            <p className="text-sm text-slate-500">Your imported comments will not be deleted.</p>
          </div>
        }
        confirmText="Reset Insights"
        cancelText="Cancel"
        confirmVariant="danger"
        isLoading={isResetting}
        onConfirm={handleResetInsights}
        onCancel={() => setShowResetModal(false)}
        icon={
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        }
      />

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        trigger="feature_blocked"
        onClose={() => setShowPaywall(false)}
      />
    </div>
  )
}
