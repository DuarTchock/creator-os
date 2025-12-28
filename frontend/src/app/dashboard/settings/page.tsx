'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface SubscriptionStatus {
  status: string;
  tier: string;
  trial_ends_at: string | null;
  is_active: boolean;
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    loadUserAndSubscription();
  }, []);

  const loadUserAndSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }
      
      setUser(session.user);

      // Get subscription status
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/stripe/subscription-status`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/stripe/create-portal-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; text: string }> = {
      active: { color: 'bg-green-500/20 text-green-400', text: 'Active' },
      trialing: { color: 'bg-blue-500/20 text-blue-400', text: 'Trial' },
      cancelled: { color: 'bg-red-500/20 text-red-400', text: 'Cancelled' },
      past_due: { color: 'bg-yellow-500/20 text-yellow-400', text: 'Past Due' },
      none: { color: 'bg-gray-500/20 text-gray-400', text: 'Free' }
    };
    const badge = badges[status] || badges.none;
    return <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>{badge.text}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
      <p className="text-gray-400 mb-8">Manage your account and subscription</p>

      <div className="grid gap-6 max-w-2xl">
        {/* Profile Section */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <p className="text-white">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">User ID</label>
              <p className="text-gray-500 text-sm font-mono">{user?.id}</p>
            </div>
          </div>
        </div>

        {/* Subscription Section */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Subscription</h2>
            {subscription && getStatusBadge(subscription.status)}
          </div>

          {subscription?.is_active ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-700">
                <span className="text-gray-400">Plan</span>
                <span className="text-white font-medium">Creator OS Pro</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-700">
                <span className="text-gray-400">Price</span>
                <span className="text-white">$29/month</span>
              </div>
              {subscription.status === 'trialing' && subscription.trial_ends_at && (
                <div className="flex items-center justify-between py-3 border-b border-gray-700">
                  <span className="text-gray-400">Trial ends</span>
                  <span className="text-white">{new Date(subscription.trial_ends_at).toLocaleDateString()}</span>
                </div>
              )}
              <button
                onClick={handleManageSubscription}
                disabled={actionLoading}
                className="w-full mt-4 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition"
              >
                {actionLoading ? 'Loading...' : 'Manage Subscription'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-400">
                You're currently on the free plan. Upgrade to Pro to unlock all features.
              </p>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">Pro Plan includes:</h3>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>✓ Unlimited Brand Deals</li>
                  <li>✓ AI-powered pitch generation</li>
                  <li>✓ Unlimited comment imports</li>
                  <li>✓ AI audience insights</li>
                  <li>✓ Priority support</li>
                </ul>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={actionLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition"
              >
                {actionLoading ? 'Loading...' : 'Upgrade to Pro - $29/mo'}
              </button>
              <p className="text-center text-gray-500 text-sm">14-day free trial included</p>
            </div>
          )}
        </div>

        {/* Danger Zone */}
        <div className="bg-gray-800 rounded-xl p-6 border border-red-500/20">
          <h2 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h2>
          <p className="text-gray-400 text-sm mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
