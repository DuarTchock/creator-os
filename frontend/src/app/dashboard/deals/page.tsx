'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  Plus, 
  Search, 
  Sparkles,
  X,
  Loader2,
  GripVertical,
  Mail,
  Copy,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Deal {
  id: string
  brand_name: string
  brand_email: string | null
  status: string
  amount: number | null
  currency: string
  category: string | null
  source: string
  notes: string | null
  created_at: string
}

const COLUMNS = [
  { id: 'lead', title: 'Leads', color: 'bg-blue-500' },
  { id: 'outreach', title: 'Outreach', color: 'bg-yellow-500' },
  { id: 'negotiation', title: 'Negotiation', color: 'bg-purple-500' },
  { id: 'closed_won', title: 'Closed Won', color: 'bg-green-500' },
  { id: 'closed_lost', title: 'Closed Lost', color: 'bg-red-500' },
]

export default function DealsPage() {
  const searchParams = useSearchParams()
  const [deals, setDeals] = useState<Deal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showNewDealModal, setShowNewDealModal] = useState(searchParams.get('new') === 'true')
  const [showPitchModal, setShowPitchModal] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)
  const [newDeal, setNewDeal] = useState({
    brand_name: '',
    brand_email: '',
    amount: '',
    category: '',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // AI Pitch states
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false)
  const [generatedPitch, setGeneratedPitch] = useState('')
  const [pitchTone, setPitchTone] = useState('professional')
  const [creatorInfo, setCreatorInfo] = useState({
    name: '',
    niche: '',
    followers: '',
    unique_value: ''
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchDeals()
    // Load creator info from localStorage
    const savedInfo = localStorage.getItem('creatorInfo')
    if (savedInfo) {
      setCreatorInfo(JSON.parse(savedInfo))
    }
  }, [])

  const fetchDeals = async () => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load deals')
      return
    }

    setDeals(data || [])
    setIsLoading(false)
  }

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const supabase = createBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast.error('Not authenticated')
      return
    }

    const { data, error } = await supabase
      .from('deals')
      .insert({
        user_id: user.id,
        brand_name: newDeal.brand_name,
        brand_email: newDeal.brand_email || null,
        amount: newDeal.amount ? parseFloat(newDeal.amount) : null,
        category: newDeal.category || null,
        notes: newDeal.notes || null,
        status: 'lead',
        source: 'manual',
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to create deal')
      setIsSubmitting(false)
      return
    }

    setDeals([data, ...deals])
    setShowNewDealModal(false)
    setNewDeal({ brand_name: '', brand_email: '', amount: '', category: '', notes: '' })
    setIsSubmitting(false)
    toast.success('Deal created!')
  }

  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    
    if (!draggedDeal || draggedDeal.status === newStatus) {
      setDraggedDeal(null)
      return
    }

    // Optimistic update
    setDeals(deals.map(d => 
      d.id === draggedDeal.id ? { ...d, status: newStatus } : d
    ))

    const supabase = createBrowserClient()
    const { error } = await supabase
      .from('deals')
      .update({ status: newStatus })
      .eq('id', draggedDeal.id)

    if (error) {
      toast.error('Failed to update deal')
      // Revert on error
      setDeals(deals.map(d => 
        d.id === draggedDeal.id ? { ...d, status: draggedDeal.status } : d
      ))
    } else {
      toast.success(`Moved to ${newStatus.replace('_', ' ')}`)
    }

    setDraggedDeal(null)
  }

  const handleDeleteDeal = async (dealId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this deal?')) return

    const supabase = createBrowserClient()
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', dealId)

    if (error) {
      toast.error('Failed to delete deal')
      return
    }

    setDeals(deals.filter(d => d.id !== dealId))
    toast.success('Deal deleted')
  }

  const handleOpenPitchModal = (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeal(deal)
    setGeneratedPitch('')
    setShowPitchModal(true)
  }

  const handleGeneratePitch = async () => {
    if (!selectedDeal) return
    
    // Save creator info
    localStorage.setItem('creatorInfo', JSON.stringify(creatorInfo))
    
    setIsGeneratingPitch(true)
    setGeneratedPitch('')

    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('http://localhost:8000/api/ai/generate-pitch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          brand_name: selectedDeal.brand_name,
          brand_category: selectedDeal.category || 'general',
          creator_name: creatorInfo.name || 'Creator',
          creator_niche: creatorInfo.niche || 'content creation',
          follower_count: creatorInfo.followers || '10,000',
          unique_value: creatorInfo.unique_value || 'engaging content and authentic connection with audience',
          tone: pitchTone
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate pitch')
      }

      const data = await response.json()
      setGeneratedPitch(data.pitch)
      toast.success('Pitch generated!')
    } catch (error) {
      toast.error('Failed to generate pitch. Make sure the backend is running.')
      console.error(error)
    }

    setIsGeneratingPitch(false)
  }

  const handleCopyPitch = () => {
    navigator.clipboard.writeText(generatedPitch)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredDeals = deals.filter(deal =>
    deal.brand_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getDealsByStatus = (status: string) =>
    filteredDeals.filter(deal => deal.status === status)

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
          <h1 className="text-2xl font-bold">Brand Deals</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your sponsorship pipeline
          </p>
        </div>
        <button
          onClick={() => setShowNewDealModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Add Deal
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          placeholder="Search deals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input w-full pl-12"
        />
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-72"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${column.color}`} />
              <h3 className="font-semibold">{column.title}</h3>
              <span className="text-xs text-slate-500 bg-dark-tertiary px-2 py-0.5 rounded-full">
                {getDealsByStatus(column.id).length}
              </span>
            </div>

            {/* Cards Container */}
            <div className={cn(
              "space-y-3 min-h-[200px] p-2 rounded-xl transition-colors",
              draggedDeal && draggedDeal.status !== column.id && "bg-dark-tertiary/50 border-2 border-dashed border-dark-border"
            )}>
              {getDealsByStatus(column.id).map((deal) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, deal)}
                  className={cn(
                    "card p-4 cursor-grab active:cursor-grabbing hover:border-primary-500/30 transition-all group",
                    draggedDeal?.id === deal.id && "opacity-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-slate-600" />
                      <h4 className="font-medium">{deal.brand_name}</h4>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleOpenPitchModal(deal, e)}
                        className="text-slate-500 hover:text-primary-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Generate AI Pitch"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDeal(deal.id, e)}
                        className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete deal"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {deal.category && (
                    <span className="inline-block text-xs text-slate-500 bg-dark-tertiary px-2 py-0.5 rounded mt-2">
                      {deal.category}
                    </span>
                  )}
                  
                  {deal.amount && (
                    <p className="text-lg font-semibold text-primary-400 mt-2">
                      {formatCurrency(deal.amount, deal.currency)}
                    </p>
                  )}
                  
                  {deal.brand_email && (
                    <p className="text-xs text-slate-500 mt-2 truncate">
                      {deal.brand_email}
                    </p>
                  )}

                  {/* Quick pitch button */}
                  <button
                    onClick={(e) => handleOpenPitchModal(deal, e)}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary-500/10 text-primary-400 text-sm hover:bg-primary-500/20 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Pitch
                  </button>
                </div>
              ))}

              {getDealsByStatus(column.id).length === 0 && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No deals
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New Deal Modal */}
      {showNewDealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md animate-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Add New Deal</h2>
              <button
                onClick={() => setShowNewDealModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Brand Name *</label>
                <input
                  type="text"
                  required
                  value={newDeal.brand_name}
                  onChange={(e) => setNewDeal({ ...newDeal, brand_name: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., Nike, Spotify"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Brand Email</label>
                <input
                  type="email"
                  value={newDeal.brand_email}
                  onChange={(e) => setNewDeal({ ...newDeal, brand_email: e.target.value })}
                  className="input w-full"
                  placeholder="contact@brand.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Deal Amount ($)</label>
                <input
                  type="number"
                  value={newDeal.amount}
                  onChange={(e) => setNewDeal({ ...newDeal, amount: e.target.value })}
                  className="input w-full"
                  placeholder="5000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <select
                  value={newDeal.category}
                  onChange={(e) => setNewDeal({ ...newDeal, category: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Select category</option>
                  <option value="Fashion">Fashion</option>
                  <option value="Tech">Tech</option>
                  <option value="Beauty">Beauty</option>
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="Fitness">Fitness</option>
                  <option value="Travel">Travel</option>
                  <option value="Finance">Finance</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={newDeal.notes}
                  onChange={(e) => setNewDeal({ ...newDeal, notes: e.target.value })}
                  className="input w-full h-24 resize-none"
                  placeholder="Any additional details..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewDealModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Deal
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Pitch Modal */}
      {showPitchModal && selectedDeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary-400" />
                  AI Pitch Generator
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Generate a personalized pitch email for {selectedDeal.brand_name}
                </p>
              </div>
              <button
                onClick={() => setShowPitchModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Creator Info Form */}
            <div className="space-y-4 mb-6">
              <h3 className="font-medium text-sm text-slate-300">Your Info (saved for future pitches)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Your Name</label>
                  <input
                    type="text"
                    value={creatorInfo.name}
                    onChange={(e) => setCreatorInfo({ ...creatorInfo, name: e.target.value })}
                    className="input w-full"
                    placeholder="Carlos Duarte"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Follower Count</label>
                  <input
                    type="text"
                    value={creatorInfo.followers}
                    onChange={(e) => setCreatorInfo({ ...creatorInfo, followers: e.target.value })}
                    className="input w-full"
                    placeholder="50,000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Your Niche</label>
                <input
                  type="text"
                  value={creatorInfo.niche}
                  onChange={(e) => setCreatorInfo({ ...creatorInfo, niche: e.target.value })}
                  className="input w-full"
                  placeholder="Tech reviews, lifestyle, fitness..."
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Your Unique Value</label>
                <textarea
                  value={creatorInfo.unique_value}
                  onChange={(e) => setCreatorInfo({ ...creatorInfo, unique_value: e.target.value })}
                  className="input w-full h-20 resize-none"
                  placeholder="What makes you special? e.g., High engagement rate, authentic storytelling, specific audience demographic..."
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Tone</label>
                <select
                  value={pitchTone}
                  onChange={(e) => setPitchTone(e.target.value)}
                  className="input w-full"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly & Casual</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="concise">Short & Concise</option>
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGeneratePitch}
              disabled={isGeneratingPitch}
              className="btn-primary w-full flex items-center justify-center gap-2 mb-6"
            >
              {isGeneratingPitch ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Pitch Email
                </>
              )}
            </button>

            {/* Generated Pitch */}
            {generatedPitch && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary-400" />
                    Generated Pitch
                  </h3>
                  <button
                    onClick={handleCopyPitch}
                    className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 bg-dark-tertiary rounded-xl">
                  <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans">
                    {generatedPitch}
                  </pre>
                </div>
                
                {selectedDeal.brand_email && (
                  <a
                    href={`mailto:${selectedDeal.brand_email}?subject=Partnership Opportunity&body=${encodeURIComponent(generatedPitch)}`}
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Open in Email Client
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
