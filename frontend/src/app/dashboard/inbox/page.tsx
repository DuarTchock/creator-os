'use client'

import { useState, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { 
  Upload, 
  MessageSquare, 
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function InboxPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file')
      return
    }

    setIsUploading(true)
    setUploadResult(null)

    try {
      const text = await file.text()
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
          content: content,
          platform: platformIndex !== -1 ? (values[platformIndex] || 'other').toLowerCase() : 'other',
          author_name: authorIndex !== -1 ? values[authorIndex] : null,
          is_processed: false,
        })
      }

      // Batch insert
      const { error } = await supabase
        .from('comments')
        .insert(comments)

      if (error) {
        toast.error('Failed to import comments')
        console.error(error)
      } else {
        toast.success(`Imported ${comments.length} comments!`)
        setUploadResult({ success: comments.length, failed })
      }
    } catch (error) {
      toast.error('Failed to parse CSV file')
      console.error(error)
    }

    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
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
            onChange={handleFileUpload}
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

      {/* Coming Soon Features */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6 opacity-60">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-blue-400" />
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
    </div>
  )
}
