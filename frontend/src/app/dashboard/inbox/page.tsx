'use client'

import { useState, useRef, useEffect } from 'react'
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
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Import {
  id: string
  name: string
  file_name: string | null
  platform: string
  comment_count: number
  created_at: string
}

export default function InboxPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null)
  const [imports, setImports] = useState<Import[]>([])
  const [isLoadingImports, setIsLoadingImports] = useState(true)
  const [showNameModal, setShowNameModal] = useState(false)
  const [importName, setImportName] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchImports()
  }, [])

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

      // Parse CSV
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

      // Detect platform from file or column
      let detectedPlatform = 'csv'
      if (platformIndex !== -1) {
        const firstPlatform = lines[1]?.split(',')[platformIndex]?.trim().toLowerCase()
        if (firstPlatform && ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook'].includes(firstPlatform)) {
          detectedPlatform = firstPlatform
        }
      }

      // Create import record first
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

      // Batch insert comments
      const { error } = await supabase
        .from('comments')
        .insert(comments)

      if (error) {
        toast.error('Failed to import comments')
        console.error(error)
        // Delete the import record if comments failed
        await supabase.from('imports').delete().eq('id', importRecord.id)
      } else {
        // Update import with actual count
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

  const handleDeleteImport = async (importId: string) => {
    if (!confirm('This will delete all comments and insights from this import. Continue?')) {
      return
    }

    setDeletingImportId(importId)

    try {
      const supabase = createBrowserClient()
      
      // Delete clusters associated with this import
      await supabase.from('clusters').delete().eq('import_id', importId)
      
      // Delete comments associated with this import
      await supabase.from('comments').delete().eq('import_id', importId)
      
      // Delete the import itself
      const { error } = await supabase.from('imports').delete().eq('id', importId)

      if (error) {
        toast.error('Failed to delete import')
      } else {
        toast.success('Import deleted')
        setImports(imports.filter(i => i.id !== importId))
      }
    } catch (error) {
      toast.error('Failed to delete import')
    }

    setDeletingImportId(null)
  }

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
                  onClick={() => handleDeleteImport(imp.id)}
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

      {/* Coming Soon Features */}
      <div className="grid md:grid-cols-2 gap-6">
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

        <div className="card p-6 opacity-60">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold">YouTube Integration</h3>
              <p className="text-sm text-slate-500">Coming soon</p>
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Connect your YouTube channel to automatically import video comments.
          </p>
        </div>
      </div>

      {/* Name Import Modal */}
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
              Give this import a name so you can identify it later (e.g., "YouTube Dec 2024", "Instagram Q4").
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
    </div>
  )
}
