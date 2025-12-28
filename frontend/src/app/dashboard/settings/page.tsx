'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useUserStore } from '@/lib/store'
import { 
  User, 
  Mail, 
  CreditCard,
  Link as LinkIcon,
  Loader2,
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user, setUser } = useUserStore()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSaveProfile = async () => {
    setIsSaving(true)
    
    const supabase = createBrowserClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user?.id)

    if (error) {
      toast.error('Failed to update profile')
    } else {
      setUser({ ...user!, full_name: fullName })
      toast.success('Profile updated!')
    }

    setIsSaving(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary-400" />
          Profile
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input w-full opacity-60"
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Subscription Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary-400" />
          Subscription
        </h2>
        
        <div className="flex items-center justify-between p-4 bg-dark-tertiary rounded-xl">
          <div>
            <p className="font-medium capitalize">{user?.subscription_tier || 'Free'} Plan</p>
            <p className="text-sm text-slate-500">
              {user?.subscription_tier === 'free' 
                ? 'Limited features' 
                : 'Full access to all features'}
            </p>
          </div>
          <button className="btn-secondary">
            {user?.subscription_tier === 'free' ? 'Upgrade' : 'Manage'}
          </button>
        </div>
      </div>

      {/* Integrations Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-primary-400" />
          Integrations
        </h2>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-dark-tertiary rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
                <Mail className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium">Gmail</p>
                <p className="text-sm text-slate-500">Auto-detect brand emails</p>
              </div>
            </div>
            <button className="btn-secondary text-sm">Connect</button>
          </div>

          <div className="flex items-center justify-between p-4 bg-dark-tertiary rounded-xl opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-500/15 flex items-center justify-center">
                <span className="text-pink-400 font-bold">IG</span>
              </div>
              <div>
                <p className="font-medium">Instagram</p>
                <p className="text-sm text-slate-500">Coming soon</p>
              </div>
            </div>
            <span className="text-xs text-slate-500 bg-dark-bg px-3 py-1 rounded-full">Soon</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-dark-tertiary rounded-xl opacity-60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
                <span className="text-red-400 font-bold">YT</span>
              </div>
              <div>
                <p className="font-medium">YouTube</p>
                <p className="text-sm text-slate-500">Coming soon</p>
              </div>
            </div>
            <span className="text-xs text-slate-500 bg-dark-bg px-3 py-1 rounded-full">Soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}
