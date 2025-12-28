import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Creator OS - Brand Deal Management for Influencers',
  description: 'Unified platform for managing brand deals and audience insights. AI-powered pitches, deal tracking, and comment analysis.',
  keywords: ['influencer', 'brand deals', 'CRM', 'creator economy', 'sponsorship'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-dark-bg text-slate-100 antialiased">
        {/* Background pattern */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 opacity-40" style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% -10%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 110%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)
            `
          }} />
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }} />
        </div>
        
        {/* Main content */}
        <div className="relative z-10">
          {children}
        </div>
        
        {/* Toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: 'bg-dark-card border border-dark-border text-slate-100',
            duration: 4000,
            style: {
              background: '#16161f',
              color: '#f8fafc',
              border: '1px solid rgba(148, 163, 184, 0.1)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#16161f',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#16161f',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
