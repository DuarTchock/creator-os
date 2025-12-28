'use client';

import { useRouter } from 'next/navigation';

interface PaywallModalProps {
  isOpen: boolean;
  daysLeft?: number;
  onClose?: () => void;
  trigger?: 'expired' | 'feature_blocked';
}

export default function PaywallModal({ isOpen, daysLeft, onClose, trigger = 'expired' }: PaywallModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const isFeatureBlocked = trigger === 'feature_blocked';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl max-w-md w-full p-8 relative">
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {isFeatureBlocked ? 'Premium Feature' : 'Free Trial Expired'}
          </h2>
          <p className="text-gray-400">
            {isFeatureBlocked
              ? 'Your free trial has ended. Upgrade to Pro to unlock AI-powered features.'
              : 'Your 7-day free trial has ended. Upgrade to Pro to continue using Creator OS.'}
          </p>
        </div>

        {/* Features reminder */}
        <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
          <h3 className="text-white font-medium mb-3">Pro includes:</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Unlimited Brand Deals
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              AI-Powered Pitch Generator
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Unlimited Comment Analysis
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              AI Audience Insights
            </li>
          </ul>
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/pricing')}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-lg font-semibold text-lg transition mb-3"
        >
          Upgrade to Pro - $29/mo
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full text-gray-400 hover:text-white py-2 text-sm transition"
          >
            Maybe later
          </button>
        )}
      </div>
    </div>
  );
}
