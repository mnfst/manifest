import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

export function PromoBanner() {
  return (
    <div className="bg-gradient-to-r from-pink-400 via-pink-500 to-fuchsia-500 text-white">
      <Link
        href="https://manifest.build?private=beta"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Sparkles className="h-4 w-4 flex-shrink-0 animate-pulse" />
        <span className="text-center">
          Want to skip coding?{' '}
          <span className="underline underline-offset-2 decoration-2">
            Join our visual builder private BETA
          </span>
        </span>
        <ArrowRight className="h-4 w-4 flex-shrink-0" />
      </Link>
    </div>
  )
}
