'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'

// Social card components
import {
  InlineInstagramPost,
  InlineLinkedInPost,
  InlineXPost,
  InlineYouTubePost
} from '@/registry/inline/inline-social-cards'

// UI components
import { CodeBlock } from '@/components/blocks/code-block'
import { InstallCommands } from '@/components/blocks/install-commands'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SocialCard {
  id: string
  name: string
  platform: string
  component: React.ReactNode
  registryName: string
  icon: React.ReactNode
  brandColor: string
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

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

const socialCards: SocialCard[] = [
  {
    id: 'x-post',
    name: 'X Post',
    platform: 'X (Twitter)',
    component: <InlineXPost />,
    registryName: 'inline-social-cards',
    icon: <XIcon className="h-5 w-5" />,
    brandColor: 'bg-foreground text-background'
  },
  {
    id: 'instagram-post',
    name: 'Instagram Post',
    platform: 'Instagram',
    component: <InlineInstagramPost />,
    registryName: 'inline-social-cards',
    icon: <InstagramIcon className="h-5 w-5" />,
    brandColor: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white'
  },
  {
    id: 'linkedin-post',
    name: 'LinkedIn Post',
    platform: 'LinkedIn',
    component: <InlineLinkedInPost />,
    registryName: 'inline-social-cards',
    icon: <LinkedInIcon className="h-5 w-5" />,
    brandColor: 'bg-[#0A66C2] text-white'
  },
  {
    id: 'youtube-post',
    name: 'YouTube Post',
    platform: 'YouTube',
    component: <InlineYouTubePost />,
    registryName: 'inline-social-cards',
    icon: <YouTubeIcon className="h-5 w-5" />,
    brandColor: 'bg-[#FF0000] text-white'
  }
]

function CodeViewer({ registryName }: { registryName: string }) {
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCode() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/r/${registryName}.json`)
        if (!response.ok) {
          throw new Error('Failed to fetch component')
        }
        const data = await response.json()
        const content = data.files?.[0]?.content
        if (content) {
          setCode(content)
        } else {
          setError('No source code available')
        }
      } catch {
        setError('Failed to load source code')
      } finally {
        setLoading(false)
      }
    }
    fetchCode()
  }, [registryName])

  if (loading) {
    return (
      <div className="rounded-lg bg-muted p-4 animate-pulse min-h-[500px]">
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2" />
        <div className="h-4 bg-muted-foreground/20 rounded w-1/2 mb-2" />
        <div className="h-4 bg-muted-foreground/20 rounded w-2/3" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-muted p-4 text-muted-foreground text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="max-h-[500px] overflow-y-auto rounded-lg">
      <CodeBlock code={code || ''} language="tsx" />
    </div>
  )
}

function SocialCardsContent() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-card">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/blocks" className="hover:text-foreground transition-colors">
              Blocks
            </Link>
            <span>/</span>
            <span className="text-foreground">Social Cards</span>
          </div>
          <h1 className="text-3xl font-bold">Social Cards</h1>
          <p className="text-muted-foreground mt-2">
            Social media post cards for X, Instagram, LinkedIn, and YouTube.
            Perfect for displaying social content in conversational interfaces.
          </p>
        </div>

        {/* All Social Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {socialCards.map((card) => (
            <div key={card.id} id={card.id} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', card.brandColor)}>
                  {card.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{card.name}</h2>
                  <p className="text-sm text-muted-foreground">{card.platform}</p>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4">
                {card.component}
              </div>
            </div>
          ))}
        </div>

        {/* Installation & Code Section */}
        <div className="border-t pt-8">
          <h2 className="text-2xl font-bold mb-2">Installation</h2>
          <p className="text-muted-foreground mb-6">
            All social card components are included in a single package
          </p>

          <div className="space-y-6">
            {/* Install Commands */}
            <div className="rounded-lg bg-card border p-4">
              <InstallCommands componentName="inline-social-cards" />
            </div>

            {/* Code Preview */}
            <Tabs defaultValue="code" className="w-full">
              <TabsList>
                <TabsTrigger value="code">Source Code</TabsTrigger>
              </TabsList>
              <TabsContent value="code">
                <CodeViewer registryName="inline-social-cards" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SocialCardsPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-[calc(100vh-3.5rem)] bg-card" />}
    >
      <SocialCardsContent />
    </Suspense>
  )
}
