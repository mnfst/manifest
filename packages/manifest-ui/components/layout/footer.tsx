import { ArrowUpRight, Github } from 'lucide-react'
import Link from 'next/link'

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

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

const footerLinks = [
  { href: '/', label: 'Home' },
  { href: '/blocks', label: 'Blocks' },
  {
    href: 'https://github.com/mnfst/manifest/discussions/new?category=feature-request',
    label: 'Suggest a Block',
    external: true
  },
  {
    href: 'https://manifest.build',
    label: 'Your App in ChatGPT',
    external: true
  }
]

const socialLinks = [
  {
    href: 'https://github.com/mnfst/manifest',
    label: 'GitHub',
    icon: Github
  },
  {
    href: 'https://discord.com/invite/FepAked3W7',
    label: 'Discord',
    icon: DiscordIcon
  },
  {
    href: 'https://www.linkedin.com/company/mnfst',
    label: 'LinkedIn',
    icon: LinkedInIcon
  }
]

export function Footer() {
  return (
    <footer className="border-t bg-white dark:bg-[#0a0a0a]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Column 1: Logo and tagline */}
          <div className="space-y-4">
            <Link href="/" className="inline-block">
              <img
                src="/logo-manifest-ui.svg"
                alt="Manifest UI"
                className="h-8 w-auto dark:hidden"
              />
              <img
                src="/logo-manifest-ui-white.svg"
                alt="Manifest UI"
                className="h-8 w-auto hidden dark:block"
              />
            </Link>
            <p className="text-sm text-muted-foreground">
              Beautiful shadcn/ui components library for building ChatGPT Apps.
            </p>
          </div>

          {/* Column 2: Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Links</h3>
            <nav className="flex flex-col space-y-2">
              {footerLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                  {link.external && <ArrowUpRight className="h-3 w-3" />}
                </Link>
              ))}
            </nav>
          </div>

          {/* Column 3: Social */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Social</h3>
            <div className="flex space-x-4">
              {socialLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={link.label}
                >
                  <link.icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
