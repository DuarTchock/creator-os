'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { 
  Upload, 
  MessageSquare, 
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  Calendar,
  X,
  AlertTriangle,
  Youtube,
  ExternalLink,
  Check,
  Link2,
  Unlink
} from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ConfirmModal'

interface Import {
  id: string
  name: string
  file_name: string | null
  platform: string
  comment_count: number
  created_at: string
}

interface YouTubeVideo {
  video_id: string
  title: string
  description: string
  thumbnail: string
  published_at: string
}

interface YouTubeStatus {
  connected: boolean
  channel_name?: string
  account_email?: string
  last_sync_at?: string
}

export default function InboxPage() {
  const searchParams = useSearchParams()
  
  // CSV Upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null)
  const [imports, setImports] = useState<Import[]>([])
  const [isLoadingImports, setIsLoadingImports] = useState(true)
  const [showNameModal, setShowNameModal] = useState(false)
  const [importName, setImportName] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [importToDelete, setImportToDelete] = useState<Import | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // YouTube state
  const [youtubeStatus, setYoutubeStatus] = useState<YouTubeStatus>({ connected: false })
  const [isLoadingYouTube, setIsLoadingYouTube] = useState(true)
  const [isConnectingYouTube, setIsConnectingYouTube] = useState(false)
  const [showYouTubeModal, setShowYouTubeModal] = useState(false)
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([])
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set())
  const [isLoadingVideos, setIsLoadingVideos] = useState(false)
  const [isImportingComments, setIsImportingComments] = useState(false)
  const [youtubeImportName, setYoutubeImportName] = useState('')
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  useEffect(() => {
    fetchImports()
    fetchYouTubeStatus()
    
    // Handle OAuth callback
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    if (success === 'youtube') {
      toast.success('YouTube connected successfully!')
      fetchYouTubeStatus()
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/inbox')
    } else if (error) {
      toast.error(`Connection failed: ${error}`)
      window.history.replaceState({}, '', '/dashboard/inbox')
    }
  }, [searchParams])

  // ============================================
  // CSV Upload Functions (existing)
  // ============================================

  const fetchImports = async () => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('imports')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setImports(data)
    }
    setIsLoadingImports(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    setPendingFile(file)
    setImportName(file.name.replace('.csv', ''))
    setShowNameModal(true)
  }

  const handleFileUpload = async () => {
    if (!pendingFile || !importName.trim()) {
      toast.error('Please enter a name for this import')
      return
    }

    setShowNameModal(false)
    setIsUploading(true)
    setUploadResult(null)

    try {
      const text = await pendingFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        toast.error('CSV file is empty or invalid')
        setIsUploading(false)
        return
      }

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
      const contentIndex = headers.findIndex(h => h.includes('content') || h.includes('comment') || h.includes('message'))
      const platformIndex = headers.findIndex(h => h.includes('platform') || h.includes('source'))
      const authorIndex = headers.findIndex(h => h.includes('author') || h.includes('name') || h.includes('user'))

      if (contentIndex === -1) {
        toast.error('CSV must have a "content" or "comment" column')
        setIsUploading(false)
        return
      }

      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Not authenticated')
        setIsUploading(false)
        return
      }

      let detectedPlatform = 'csv'
      if (platformIndex !== -1) {
        const firstPlatform = lines[1]?.split(',')[platformIndex]?.trim().toLowerCase()
        if (firstPlatform && ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook'].includes(firstPlatform)) {
          detectedPlatform = firstPlatform
        }
      }

      const { data: importRecord, error: importError } = await supabase
        .from('imports')
        .insert({
          user_id: user.id,
          name: importName.trim(),
          file_name: pendingFile.name,
          platform: detectedPlatform,
          comment_count: 0
        })
        .select()
        .single()

      if (importError || !importRecord) {
        toast.error('Failed to create import record')
        setIsUploading(false)
        return
      }

      const comments = []
      let failed = 0

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const content = values[contentIndex]
        
        if (!content || content.length < 2) {
          failed++
          continue
        }

        comments.push({
          user_id: user.id,
          import_id: importRecord.id,
          content: content,
          platform: platformIndex !== -1 ? (values[platformIndex] || detectedPlatform).toLowerCase() : detectedPlatform,
          author_name: authorIndex !== -1 ? values[authorIndex] : null,
          is_processed: false,
        })
      }

      const { error } = await supabase
        .from('comments')
        .insert(comments)

      if (error) {
        toast.error('Failed to import comments')
        console.error(error)
        await supabase.from('imports').delete().eq('id', importRecord.id)
      } else {
        await supabase
          .from('imports')
          .update({ comment_count: comments.length })
          .eq('id', importRecord.id)

        toast.success(`Imported ${comments.length} comments!`)
        setUploadResult({ success: comments.length, failed })
        fetchImports()
      }
    } catch (error) {
      toast.error('Failed to parse CSV file')
      console.error(error)
    }

    setIsUploading(false)
    setPendingFile(null)
    setImportName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteClick = (imp: Import) => {
    setImportToDelete(imp)
    setShowDeleteModal(true)
  }

  const handleDeleteImport = async () => {
    if (!importToDelete) return

    setDeletingImportId(importToDelete.id)

    try {
      const supabase = createBrowserClient()
      
      await supabase.from('cluster_comments').delete().in('comment_id', 
        (await supabase.from('comments').select('id').eq('import_id', importToDelete.id)).data?.map(c => c.id) || []
      )
      await supabase.from('comments').delete().eq('import_id', importToDelete.id)
      const { error } = await supabase.from('imports').delete().eq('id', importToDelete.id)

      if (error) {
        toast.error('Failed to delete import')
      } else {
        toast.success('Import deleted successfully')
        setImports(imports.filter(i => i.id !== importToDelete.id))
      }
    } catch (error) {
      toast.error('Failed to delete import')
    }

    setDeletingImportId(null)
    setShowDeleteModal(false)
    setImportToDelete(null)
  }

  // ============================================
  // YouTube Functions
  // ============================================

  const fetchYouTubeStatus = async () => {
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        setIsLoadingYouTube(false)
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/integrations/youtube/status`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setYoutubeStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch YouTube status:', error)
    }
    setIsLoadingYouTube(false)
  }

  const handleConnectYouTube = async () => {
    setIsConnectingYouTube(true)
    
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        toast.error('Not authenticated')
        setIsConnectingYouTube(false)
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/integrations/youtube/connect`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }
      )

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.authorization_url
      } else {
        toast.error('Failed to initiate YouTube connection')
        setIsConnectingYouTube(false)
      }
    } catch (error) {
      toast.error('Failed to connect YouTube')
      setIsConnectingYouTube(false)
    }
  }

  const handleDisconnectYouTube = async () => {
    setIsDisconnecting(true)
    
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/integrations/youtube/disconnect`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }
      )

      if (response.ok) {
        toast.success('YouTube disconnected')
        setYoutubeStatus({ connected: false })
        setYoutubeVideos([])
        setSelectedVideos(new Set())
      } else {
        toast.error('Failed to disconnect YouTube')
      }
    } catch (error) {
      toast.error('Failed to disconnect YouTube')
    }
    
    setIsDisconnecting(false)
    setShowDisconnectModal(false)
  }

  const handleOpenYouTubeModal = async () => {
    setShowYouTubeModal(true)
    setIsLoadingVideos(true)
    setYoutubeImportName(`YouTube ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`)
    
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/integrations/youtube/videos?max_results=20`,
        {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setYoutubeVideos(data.videos || [])
      } else {
        toast.error('Failed to fetch videos')
      }
    } catch (error) {
      toast.error('Failed to fetch videos')
    }
    
    setIsLoadingVideos(false)
  }

  const toggleVideoSelection = (videoId: string) => {
    const newSelected = new Set(selectedVideos)
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId)
    } else {
      newSelected.add(videoId)
    }
    setSelectedVideos(newSelected)
  }

  const selectAllVideos = () => {
    if (selectedVideos.size === youtubeVideos.length) {
      setSelectedVideos(new Set())
    } else {
      setSelectedVideos(new Set(youtubeVideos.map(v => v.video_id)))
    }
  }

  const handleImportYouTubeComments = async () => {
    if (selectedVideos.size === 0) {
      toast.error('Please select at least one video')
      return
    }

    if (!youtubeImportName.trim()) {
      toast.error('Please enter a name for this import')
      return
    }

    setIsImportingComments(true)

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/integrations/youtube/import`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            video_ids: Array.from(selectedVideos),
            import_name: youtubeImportName.trim()
          })
        }
      )

      if (response.ok) {
        const data = await response.json()
        toast.success(`Imported ${data.comments_imported} comments from ${data.videos_processed} videos!`)
        setShowYouTubeModal(false)
        setSelectedVideos(new Set())
        fetchImports()
      } else {
        const error = await response.json()
        toast.error(error.detail || 'Failed to import comments')
      }
    } catch (error) {
      toast.error('Failed to import comments')
    }

    setIsImportingComments(false)
  }

  // ============================================
  // Helpers
  // ============================================

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'youtube': return 'text-red-400 bg-red-500/15'
      case 'instagram': return 'text-pink-400 bg-pink-500/15'
      case 'tiktok': return 'text-cyan-400 bg-cyan-500/15'
      case 'twitter': return 'text-blue-400 bg-blue-500/15'
      default: return 'text-slate-400 bg-slate-500/15'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Inbox Brain</h1>
        <p className="text-slate-400 text-sm mt-1">
          Import and analyze comments from your social platforms
        </p>
      </div>

      {/* Upload Section */}
      <div className="card p-8">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/15 flex items-center justify-center mx-auto mb-6">
            <Upload className="w-8 h-8 text-purple-400" />
          </div>
          
          <h2 className="text-xl font-bold mb-2">Import Comments</h2>
          <p className="text-slate-400 mb-6">
            Upload a CSV file with your comments from Instagram, YouTube, TikTok, or any other platform.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
          />
          
          <label
            htmlFor="csv-upload"
            className={`btn-primary inline-flex items-center gap-2 cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Upload CSV
              </>
            )}
          </label>

          {uploadResult && (
            <div className="mt-6 p-4 rounded-xl bg-dark-tertiary">
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span>{uploadResult.success} imported</span>
                </div>
                {uploadResult.failed > 0 && (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertCircle className="w-5 h-5" />
                    <span>{uploadResult.failed} skipped</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 p-4 rounded-xl bg-dark-tertiary text-left">
            <h3 className="font-medium mb-2">CSV Format</h3>
            <p className="text-sm text-slate-400 mb-3">
              Your CSV should have at least a "content" column. Optional columns:
            </p>
            <code className="text-xs text-slate-300 bg-dark-bg px-3 py-2 rounded block">
              content,platform,author_name,post_url
            </code>
          </div>
        </div>
      </div>

      {/* Import History */}
      {!isLoadingImports && imports.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">Import History</h2>
          <div className="space-y-3">
            {imports.map((imp) => (
              <div
                key={imp.id}
                className="flex items-center justify-between p-4 bg-dark-tertiary rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getPlatformColor(imp.platform)}`}>
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{imp.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(imp.created_at)}
                      </span>
                      <span>{imp.comment_count} comments</span>
                      <span className="capitalize">{imp.platform}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteClick(imp)}
                  disabled={deletingImportId === imp.id}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete import"
                >
                  {deletingImportId === imp.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Platform Integrations */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Instagram - Coming Soon */}
        <div className="card p-6 opacity-60">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/15 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <h3 className="font-semibold">Instagram Integration</h3>
              <p className="text-sm text-slate-500">Coming soon</p>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Connect your Instagram account to automatically import comments and DMs.
          </p>
        </div>

        {/* YouTube Integration */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center">
                <Youtube className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold">YouTube Integration</h3>
                {isLoadingYouTube ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : youtubeStatus.connected ? (
                  <p className="text-sm text-green-400">{youtubeStatus.channel_name || 'Connected'}</p>
                ) : (
                  <p className="text-sm text-slate-500">Not connected</p>
                )}
              </div>
            </div>
            
            {!isLoadingYouTube && youtubeStatus.connected && (
              <button
                onClick={() => setShowDisconnectModal(true)}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Disconnect YouTube"
              >
                <Unlink className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <p className="text-sm text-slate-400 mb-4">
            {youtubeStatus.connected 
              ? 'Import comments from your YouTube videos.'
              : 'Connect your YouTube channel to import video comments.'}
          </p>
          
          {!isLoadingYouTube && (
            youtubeStatus.connected ? (
              <button
                onClick={handleOpenYouTubeModal}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Youtube className="w-5 h-5" />
                Import Comments
              </button>
            ) : (
              <button
                onClick={handleConnectYouTube}
                disabled={isConnectingYouTube}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                {isConnectingYouTube ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="w-5 h-5" />
                    Connect YouTube
                  </>
                )}
              </button>
            )
          )}
        </div>
      </div>

      {/* CSV Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md animate-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Name Your Import</h2>
              <button
                onClick={() => {
                  setShowNameModal(false)
                  setPendingFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              Give this import a name so you can identify it later.
            </p>

            <input
              type="text"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              placeholder="Import name..."
              className="input w-full mb-4"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNameModal(false)
                  setPendingFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleFileUpload}
                disabled={!importName.trim()}
                className="btn-primary flex-1"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Videos Modal */}
      {showYouTubeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col animate-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Import YouTube Comments</h2>
                <p className="text-sm text-slate-400">Select videos to import comments from</p>
              </div>
              <button
                onClick={() => {
                  setShowYouTubeModal(false)
                  setSelectedVideos(new Set())
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Import Name */}
            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-1 block">Import Name</label>
              <input
                type="text"
                value={youtubeImportName}
                onChange={(e) => setYoutubeImportName(e.target.value)}
                placeholder="e.g., YouTube Dec 2024"
                className="input w-full"
              />
            </div>

            {/* Select All */}
            {youtubeVideos.length > 0 && (
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-dark-border">
                <button
                  onClick={selectAllVideos}
                  className="text-sm text-primary-400 hover:text-primary-300"
                >
                  {selectedVideos.size === youtubeVideos.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-slate-500">
                  {selectedVideos.size} of {youtubeVideos.length} selected
                </span>
              </div>
            )}

            {/* Videos List */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {isLoadingVideos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                </div>
              ) : youtubeVideos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No videos found in your channel
                </div>
              ) : (
                youtubeVideos.map((video) => (
                  <div
                    key={video.video_id}
                    onClick={() => toggleVideoSelection(video.video_id)}
                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all ${
                      selectedVideos.has(video.video_id)
                        ? 'bg-primary-500/15 border border-primary-500/30'
                        : 'bg-dark-tertiary hover:bg-dark-tertiary/70 border border-transparent'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedVideos.has(video.video_id)
                        ? 'bg-primary-500 border-primary-500'
                        : 'border-slate-500'
                    }`}>
                      {selectedVideos.has(video.video_id) && (
                        <Check className="w-4 h-4 text-white" />
                      )}
                    </div>
                    
                    {video.thumbnail && (
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-24 h-14 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{video.title}</h4>
                      <p className="text-xs text-slate-500 truncate">{video.description}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {new Date(video.published_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <a
                      href={`https://youtube.com/watch?v=${video.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-slate-400 hover:text-white"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-dark-border">
              <button
                onClick={() => {
                  setShowYouTubeModal(false)
                  setSelectedVideos(new Set())
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleImportYouTubeComments}
                disabled={selectedVideos.size === 0 || !youtubeImportName.trim() || isImportingComments}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {isImportingComments ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Youtube className="w-5 h-5" />
                    Import {selectedVideos.size > 0 ? `(${selectedVideos.size})` : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Import Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Import"
        message={
          <div className="space-y-2">
            <p>Are you sure you want to delete <strong>"{importToDelete?.name}"</strong>?</p>
            <p className="text-sm text-slate-500">
              This will permanently delete {importToDelete?.comment_count} comments and any insights generated from them.
            </p>
          </div>
        }
        confirmText="Delete Import"
        cancelText="Cancel"
        confirmVariant="danger"
        isLoading={deletingImportId !== null}
        onConfirm={handleDeleteImport}
        onCancel={() => {
          setShowDeleteModal(false)
          setImportToDelete(null)
        }}
        icon={
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        }
      />

      {/* Disconnect YouTube Modal */}
      <ConfirmModal
        isOpen={showDisconnectModal}
        title="Disconnect YouTube"
        message={
          <div className="space-y-2">
            <p>Are you sure you want to disconnect your YouTube account?</p>
            <p className="text-sm text-slate-500">
              Your imported comments will not be deleted, but you won't be able to import new comments until you reconnect.
            </p>
          </div>
        }
        confirmText="Disconnect"
        cancelText="Cancel"
        confirmVariant="danger"
        isLoading={isDisconnecting}
        onConfirm={handleDisconnectYouTube}
        onCancel={() => setShowDisconnectModal(false)}
        icon={
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <Unlink className="w-8 h-8 text-red-400" />
          </div>
        }
      />
    </div>
  )
}
