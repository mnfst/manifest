'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/blocks', label: 'Blocks' },
  { href: '#', label: 'Docs', disabled: true, badge: 'Coming soon' },
  { href: 'https://21st.dev', label: 'Agentic UI Builder', external: true },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-foreground" />
            <span className="font-semibold">Agentic UI</span>
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
                    ? 'text-muted-foreground cursor-not-allowed pointer-events-none'
                    : pathname === link.href
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
