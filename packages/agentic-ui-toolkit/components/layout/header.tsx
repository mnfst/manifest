'use client'

import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'
import { Github, Star } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/blocks', label: 'Blocks' },
  { href: '#', label: 'Docs', disabled: true, badge: 'Coming soon' },
  { href: 'https://21st.dev', label: 'Agentic UI Builder', external: true }
]

function formatStars(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return count.toString()
}

function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    fetch('https://api.github.com/repos/mnfst/manifest')
      .then((res) => res.json())
      .then((data) => {
        if (data.stargazers_count) {
          setStars(data.stargazers_count)
        }
      })
      .catch(() => {
        // Silently fail
      })
  }, [])

  return (
    <Link
      href="https://github.com/mnfst/manifest"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-foreground/70 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
    >
      <Github className="h-4 w-4" />
      {stars !== null && (
        <span className="hidden sm:flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          {formatStars(stars)}
        </span>
      )}
    </Link>
  )
}

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-lg dark:bg-black/80">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo-manifest-ui.svg"
              alt="Agentic UI"
              className="h-8 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md transition-colors',
                  link.disabled
                    ? 'text-muted-foreground/70 cursor-not-allowed pointer-events-none'
                    : pathname === link.href
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-foreground/70 hover:text-foreground hover:bg-muted/50'
                )}
              >
                {link.label}
                {link.badge && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {link.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <GitHubStars />
          <Link
            href="https://discord.gg/manifest"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-foreground/70 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
          >
            <DiscordIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://x.com/AiManifest"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-foreground/70 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://linkedin.com/company/mnfst"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-foreground/70 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
          >
            <LinkedInIcon className="h-4 w-4" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
