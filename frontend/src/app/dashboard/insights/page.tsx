'use client'

import { useEffect, useState } from 'react'
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

interface Cluster {
  id: string
  theme: string
  summary: string | null
  comment_count: number
  sample_comments: string[]
  content_ideas: Array<{
    title: string
    description: string
    content_type: string
  }>
  primary_platform: string | null
  platforms: string[]
  import_ids: string[]
  created_at: string
}

interface Import {
  id: string
  name: string
  platform: string
  comment_count: number
  created_at: string
}

interface CommentStats {
  total: number
  unprocessed: number
  byPlatform: Record<string, number>
}

export default function InsightsPage() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([])
  const [imports, setImports] = useState<Import[]>([])
  const [stats, setStats] = useState<CommentStats>({ total: 0, unprocessed: 0, byPlatform: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const [showNoCommentsModal, setShowNoCommentsModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  
  // Filters
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedImport, setSelectedImport] = useState<string>('all')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [clusters, selectedPlatform, selectedImport])

  const fetchData = async () => {
    const supabase = createBrowserClient()

    const { data: clustersData } = await supabase
      .from('clusters')
      .select('*')
      .eq('is_active', true)
      .order('comment_count', { ascending: false })

    setClusters(clustersData || [])

    const { data: importsData } = await supabase
      .from('imports')
      .select('*')
      .order('created_at', { ascending: false })

    setImports(importsData || [])

    const { count: total } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })

    const { count: unprocessed } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('is_processed', false)

    const { data: platformData } = await supabase
      .from('comments')
      .select('platform')
    
    const byPlatform: Record<string, number> = {}
    platformData?.forEach(c => {
      byPlatform[c.platform] = (byPlatform[c.platform] || 0) + 1
    })

    setStats({
      total: total || 0,
      unprocessed: unprocessed || 0,
      byPlatform
    })

    setIsLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...clusters]

    if (selectedPlatform !== 'all') {
      filtered = filtered.filter(c => 
        c.platforms?.includes(selectedPlatform) || c.primary_platform === selectedPlatform
      )
    }

    if (selectedImport !== 'all') {
      filtered = filtered.filter(c => 
        c.import_ids?.includes(selectedImport)
      )
    }

    const consolidated = consolidateThemes(filtered)
    setFilteredClusters(consolidated)
  }

  const consolidateThemes = (clusterList: Cluster[]): Cluster[] => {
    const themeMap = new Map<string, Cluster>()

    clusterList.forEach(cluster => {
      const normalizedTheme = cluster.theme.toLowerCase().trim()
      
      let matchedKey: string | null = null
      for (const key of Array.from(themeMap.keys())) {
        if (areSimilarThemes(normalizedTheme, key)) {
          matchedKey = key
          break
        }
      }

      if (matchedKey) {
        const existing = themeMap.get(matchedKey)!
        const mergedPlatforms = Array.from(new Set([...(existing.platforms || []), ...(cluster.platforms || [])]))
        const mergedImportIds = Array.from(new Set([...(existing.import_ids || []), ...(cluster.import_ids || [])]))
        
        themeMap.set(matchedKey, {
          ...existing,
          comment_count: existing.comment_count + cluster.comment_count,
          sample_comments: [...existing.sample_comments, ...cluster.sample_comments].slice(0, 5),
          content_ideas: [...existing.content_ideas, ...cluster.content_ideas].slice(0, 4),
          platforms: mergedPlatforms,
          import_ids: mergedImportIds
        })
      } else {
        themeMap.set(normalizedTheme, { ...cluster })
      }
    })

    return Array.from(themeMap.values()).sort((a, b) => b.comment_count - a.comment_count)
  }

  const areSimilarThemes = (theme1: string, theme2: string): boolean => {
    if (theme1 === theme2) return true
    if (theme1.includes(theme2) || theme2.includes(theme1)) return true
    
    const words1 = theme1.split(/\s+/).filter(w => w.length > 3)
    const words2 = theme2.split(/\s+/).filter(w => w.length > 3)
    
    const commonWords = words1.filter(w => 
      words2.some(w2 => w2.includes(w) || w.includes(w2))
    )
    
    return commonWords.length >= 2
  }

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
        setFilteredClusters([])
        fetchData()
      }
    } catch (error) {
      toast.error('Failed to reset insights')
    }

    setIsResetting(false)
    setShowResetModal(false)
  }

  const platforms = Object.keys(stats.byPlatform)

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
              <p className="text-2xl font-bold">{filteredClusters.length}</p>
              <p className="text-xs text-slate-500">Insight Clusters</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {(clusters.length > 0 || imports.length > 0) && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Filters:</span>
            </div>

            {platforms.length > 0 && (
              <div>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="input text-sm py-1.5"
                >
                  <option value="all">All Platforms</option>
                  {platforms.map(platform => (
                    <option key={platform} value={platform}>
                      {platform.charAt(0).toUpperCase() + platform.slice(1)} ({stats.byPlatform[platform]})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {imports.length > 0 && (
              <div>
                <select
                  value={selectedImport}
                  onChange={(e) => setSelectedImport(e.target.value)}
                  className="input text-sm py-1.5"
                >
                  <option value="all">All Imports</option>
                  {imports.map(imp => (
                    <option key={imp.id} value={imp.id}>
                      {imp.name} ({imp.comment_count})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(selectedPlatform !== 'all' || selectedImport !== 'all') && (
              <button
                onClick={() => {
                  setSelectedPlatform('all')
                  setSelectedImport('all')
                }}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clusters */}
      {filteredClusters.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-dark-tertiary flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-10 h-10 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            {clusters.length > 0 && (selectedPlatform !== 'all' || selectedImport !== 'all') 
              ? 'No insights match your filters' 
              : 'No insights yet'}
          </h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {clusters.length > 0 && (selectedPlatform !== 'all' || selectedImport !== 'all')
              ? 'Try adjusting your filters or generate new insights.'
              : 'Import some comments in the Inbox Brain section, then click "Generate Insights" to let AI analyze and cluster your audience feedback.'}
          </p>
          {clusters.length > 0 && (selectedPlatform !== 'all' || selectedImport !== 'all') && (
            <button
              onClick={() => {
                setSelectedPlatform('all')
                setSelectedImport('all')
              }}
              className="btn-secondary"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredClusters.map((cluster, index) => (
            <div
              key={cluster.id + '-' + index}
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
                    <p className="text-xs text-slate-500">{cluster.comment_count} comments</p>
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
                  {cluster.platforms.slice(0, 3).map((platform, i) => (
                    <span 
                      key={i} 
                      className={`text-xs px-2 py-0.5 rounded ${
                        platform === 'youtube' ? 'bg-red-500/15 text-red-400' :
                        platform === 'instagram' ? 'bg-pink-500/15 text-pink-400' :
                        platform === 'tiktok' ? 'bg-cyan-500/15 text-cyan-400' :
                        'bg-slate-500/15 text-slate-400'
                      }`}
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
                <p className="text-sm text-slate-500">{selectedCluster.comment_count} comments in this cluster</p>
                {selectedCluster.platforms && selectedCluster.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedCluster.platforms.map((platform, i) => (
                      <span 
                        key={i} 
                        className={`text-xs px-2 py-0.5 rounded ${
                          platform === 'youtube' ? 'bg-red-500/15 text-red-400' :
                          platform === 'instagram' ? 'bg-pink-500/15 text-pink-400' :
                          platform === 'tiktok' ? 'bg-cyan-500/15 text-cyan-400' :
                          'bg-slate-500/15 text-slate-400'
                        }`}
                      >
                        {platform}
                      </span>
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
