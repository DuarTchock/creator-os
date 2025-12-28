'use client';

import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full text-center">
        <div className="text-6xl mb-4">✉️</div>
        <h1 className="text-2xl font-bold text-white mb-4">Email Verified!</h1>
        <p className="text-gray-400 mb-6">
          Your email has been verified successfully. You can now sign in to your account.
        </p>
        <Link 
          href="/auth/login"
          className="block w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition"
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
