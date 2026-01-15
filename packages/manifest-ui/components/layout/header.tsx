'use client'

import { ThemeToggle } from '@/components/theme/theme-toggle'
import { blockCategories } from '@/lib/blocks-categories'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ChevronRight, Github, Menu, Star, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

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

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/blocks', label: 'Blocks' },
  { href: '/customize', label: 'Customize' },
  {
    href: 'https://manifest.build',
    label: 'Your App in ChatGPT',
    external: true
  }
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

function MobileMenuContent({
  isBlocksPage,
  blockId,
  onClose
}: {
  isBlocksPage: boolean
  blockId: string | null
  onClose: () => void
}) {
  const pathname = usePathname()
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    blockCategories.map((c) => c.id)
  )

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Navigation Links */}
      <div className="p-4 border-b">
        <nav className="space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={onClose}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                pathname === link.href
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-foreground/70 hover:text-foreground hover:bg-muted/50'
              )}
            >
              {link.label}
              {link.external && <ArrowUpRight className="h-3 w-3" />}
            </Link>
          ))}
        </nav>
      </div>

      {/* Blocks Sidebar Content - Only on blocks page */}
      {isBlocksPage && (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
            Components
          </p>
          <nav className="space-y-1">
            <Link
              href="/blocks"
              onClick={onClose}
              className={cn(
                'block text-xs font-medium rounded-sm transition-colors py-1.5 px-2 mb-2',
                !blockId
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              Getting Started
            </Link>
            {blockCategories.map((category) => (
              <div key={category.id}>
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex w-full items-center justify-between py-1.5 px-2 text-xs font-medium text-foreground hover:bg-muted rounded-sm transition-colors"
                >
                  {category.name}
                  <ChevronRight
                    className={cn(
                      'h-3 w-3 transition-transform',
                      expandedCategories.includes(category.id) && 'rotate-90'
                    )}
                  />
                </button>
                {expandedCategories.includes(category.id) && (
                  <div className="mt-0.5 space-y-0 mb-2">
                    {category.blocks.map((block) => (
                      <Link
                        key={block.id}
                        href={`/blocks/${category.id}/${block.id}`}
                        onClick={onClose}
                        className={cn(
                          'block my-0.5 text-xs rounded-sm transition-colors py-1.5 px-2',
                          blockId === block.id
                            ? 'bg-muted text-foreground font-medium'
                            : 'text-foreground/70 hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        {block.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      )}

      {/* Social Links */}
      <div className="p-4 border-t mt-auto">
        <div className="flex items-center gap-2">
          <Link
            href="https://github.com/mnfst/manifest"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-foreground/60 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
          >
            <Github className="h-5 w-5" />
          </Link>
          <Link
            href="https://discord.com/invite/FepAked3W7"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-foreground/60 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
          >
            <DiscordIcon className="h-5 w-5" />
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  )
}

function HeaderContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isBlocksPage = pathname.startsWith('/blocks')
  const blockId = searchParams.get('block')

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname, blockId])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-lg dark:bg-black/80">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4 md:gap-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 -ml-1.5 text-foreground/70 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/" className="flex items-center gap-2">
              <img
                src="/logo-manifest-ui.svg"
                alt="Manifest UI - ChatGPT and Claude UI Components"
                className="h-8 w-auto dark:hidden"
              />
              <img
                src="/logo-manifest-ui-white.svg"
                alt="Manifest UI - ChatGPT and Claude UI Components"
                className="h-8 w-auto hidden dark:block"
              />
            </Link>

            {/* Desktop navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md transition-colors inline-flex items-center gap-1.5',
                    pathname === link.href ||
                      (link.href === '/blocks' && isBlocksPage)
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-foreground/70 hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {link.label}
                  {link.external && <ArrowUpRight className="h-3 w-3" />}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-1">
            <GitHubStars />
            <Link
              href="https://discord.com/invite/FepAked3W7"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-foreground/70 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
            >
              <DiscordIcon className="h-4 w-4" />
            </Link>
            <ThemeToggle />
          </div>

          {/* Mobile right side - only theme toggle */}
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu panel */}
          <div className="absolute inset-y-0 left-0 w-[280px] bg-background border-r flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between h-14 px-4 border-b">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2"
              >
                <img
                  src="/logo-manifest-ui.svg"
                  alt="Manifest UI - ChatGPT and Claude UI Components"
                  className="h-7 w-auto dark:hidden"
                />
                <img
                  src="/logo-manifest-ui-white.svg"
                  alt="Manifest UI - ChatGPT and Claude UI Components"
                  className="h-7 w-auto hidden dark:block"
                />
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-foreground/70 hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Menu content */}
            <MobileMenuContent
              isBlocksPage={isBlocksPage}
              blockId={blockId}
              onClose={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

export function Header() {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-lg dark:bg-black/80">
          <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="md:hidden p-1.5 -ml-1.5">
                <Menu className="h-5 w-5 text-foreground/70" />
              </div>
              <img
                src="/logo-manifest-ui.svg"
                alt="Manifest UI - ChatGPT and Claude UI Components"
                className="h-8 w-auto dark:hidden"
              />
              <img
                src="/logo-manifest-ui-white.svg"
                alt="Manifest UI - ChatGPT and Claude UI Components"
                className="h-8 w-auto hidden dark:block"
              />
            </div>
          </div>
        </header>
      }
    >
      <HeaderContent />
    </Suspense>
  )
}
