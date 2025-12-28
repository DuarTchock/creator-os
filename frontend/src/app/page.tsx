import Link from 'next/link'
import { ArrowRight, Sparkles, Zap, BarChart3, MessageSquare } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-primary-500/25">
              C
            </div>
            <span className="text-xl font-bold gradient-text">Creator OS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/auth/login" 
              className="text-slate-300 hover:text-white transition-colors font-medium"
            >
              Sign In
            </Link>
            <Link 
              href="/auth/signup" 
              className="btn-primary flex items-center gap-2"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-6 pt-24 pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-4 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-primary-400" />
            <span className="text-sm font-medium text-primary-300">AI-Powered Creator Business OS</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Turn Brand Deals & DMs into{' '}
            <span className="gradient-text">Revenue Intelligence</span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Stop losing deals in Gmail chaos. Stop ignoring audience insights in your comments. 
            One unified platform to manage sponsors and understand your audience.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/auth/signup" 
              className="btn-primary text-lg px-8 py-4 flex items-center justify-center gap-2"
            >
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="#features" 
              className="btn-secondary text-lg px-8 py-4"
            >
              See How It Works
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold font-mono text-white">$0</div>
              <div className="text-sm text-slate-500">To start</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold font-mono text-white">6 wks</div>
              <div className="text-sm text-slate-500">To launch</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold font-mono text-white">∞</div>
              <div className="text-sm text-slate-500">Potential</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Two Powerful Tools, One Platform</h2>
          <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
            Everything you need to run your creator business, powered by AI.
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Brand Deal OS */}
            <div className="card p-8 hover:border-primary-500/30 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-primary-500/15 flex items-center justify-center mb-6">
                <Zap className="w-7 h-7 text-primary-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Brand Deal OS</h3>
              <p className="text-slate-400 mb-6">
                Your sponsorship CRM that auto-detects leads from Gmail and generates AI-powered pitches.
              </p>
              <ul className="space-y-3">
                {[
                  'Auto-detect brand emails as leads',
                  'Kanban pipeline for deal tracking',
                  'AI pitch generator with templates',
                  'Pricing suggestions based on niche'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Inbox Brain */}
            <div className="card p-8 hover:border-purple-500/30 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 flex items-center justify-center mb-6">
                <MessageSquare className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Inbox Brain</h3>
              <p className="text-slate-400 mb-6">
                Turn thousands of DMs and comments into content ideas and audience intelligence.
              </p>
              <ul className="space-y-3">
                {[
                  'Import comments from IG/YouTube',
                  'AI clusters common questions',
                  'Surface hidden objections',
                  'Weekly content brief generation'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 px-6 bg-dark-secondary/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-slate-400 mb-12">Start free, upgrade when you need more.</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="card p-6 text-left">
              <div className="text-sm font-medium text-slate-500 mb-2">Free</div>
              <div className="text-3xl font-bold mb-4">$0<span className="text-lg text-slate-500">/mo</span></div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>• 10 deals</li>
                <li>• 100 comments/mo</li>
                <li>• Manual CSV upload</li>
              </ul>
            </div>
            
            <div className="card p-6 text-left border-primary-500/50 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-xs font-bold px-3 py-1 rounded-full">
                POPULAR
              </div>
              <div className="text-sm font-medium text-primary-400 mb-2">Pro</div>
              <div className="text-3xl font-bold mb-4">$29<span className="text-lg text-slate-500">/mo</span></div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>• Unlimited deals</li>
                <li>• Gmail auto-sync</li>
                <li>• AI pitches</li>
                <li>• Unlimited comments</li>
                <li>• Weekly briefs</li>
              </ul>
            </div>
            
            <div className="card p-6 text-left">
              <div className="text-sm font-medium text-slate-500 mb-2">Agency</div>
              <div className="text-3xl font-bold mb-4">$99<span className="text-lg text-slate-500">/mo</span></div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>• Multiple creators</li>
                <li>• Team access</li>
                <li>• Priority support</li>
                <li>• API access</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to 10x Your Creator Business?</h2>
          <p className="text-xl text-slate-400 mb-10">
            Join the waitlist for early access. Be among the first to transform how you manage brand deals.
          </p>
          <Link 
            href="/auth/signup" 
            className="btn-primary text-lg px-10 py-4 inline-flex items-center gap-2"
          >
            Get Early Access <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-dark-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center font-bold text-sm">
              C
            </div>
            <span className="font-semibold">Creator OS</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2024 Creator OS. Built for creators, by creators.
          </p>
        </div>
      </footer>
    </main>
  )
}
