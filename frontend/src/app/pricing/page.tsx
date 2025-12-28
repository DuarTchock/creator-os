'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleSubscribe = async () => {
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/login?redirect=/pricing');
        return;
      }

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
      } else {
        alert('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-20">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <Link href="/" className="text-2xl font-bold text-purple-500 mb-8 inline-block">
            Creator OS
          </Link>
          <h1 className="text-4xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-400">
            Start with a 14-day free trial. No credit card required to explore.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-md mx-auto">
          <div className="bg-gray-800 rounded-2xl border-2 border-purple-500 p-8 relative">
            {/* Popular badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </span>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Creator OS Pro</h2>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-white">$29</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-gray-400 mt-2">14-day free trial included</p>
            </div>

            {/* Features */}
            <ul className="space-y-4 mb-8">
              {[
                'Unlimited Brand Deals tracking',
                'AI-powered pitch generation',
                'Unlimited comment imports',
                'AI audience insights & clustering',
                'Export deals to CSV',
                'Priority support',
                'Early access to new features'
              ].map((feature, index) => (
                <li key={index} className="flex items-center gap-3 text-gray-300">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-4 rounded-lg font-semibold text-lg transition"
            >
              {loading ? 'Loading...' : 'Start Free Trial'}
            </button>

            <p className="text-center text-gray-500 text-sm mt-4">
              Cancel anytime. No questions asked.
            </p>
          </div>
        </div>

        {/* FAQ or trust badges */}
        <div className="mt-16 text-center">
          <p className="text-gray-500">
            Questions? Email us at{' '}
            <a href="mailto:support@creatoros.app" className="text-purple-400 hover:underline">
              support@creatoros.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
