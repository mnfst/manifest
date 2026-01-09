import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import Script from 'next/script'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'ChatGPT apps shadcn/ui components - Manifest UI',
  description:
    'A collection of beautifully designed components for building ChatGPT apps and agentic UIs. Built on top of shadcn/ui.',
  metadataBase: new URL('https://ui.manifest.build'),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' }
    ],
    apple: '/favicon.png'
  },
  openGraph: {
    title: 'ChatGPT apps shadcn/ui components - Manifest UI',
    description:
      'A collection of beautifully designed components for building ChatGPT apps and agentic UIs. Built on top of shadcn/ui.',
    url: 'https://ui.manifest.build',
    siteName: 'ChatGPT apps shadcn/ui components - Manifest UI',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.webp',
        width: 1280,
        height: 640,
        type: 'image/webp',
        alt: 'Manifest UI - Open Source Agentic UI Toolkit'
      },
      {
        url: '/og-image.png',
        width: 1280,
        height: 640,
        type: 'image/png',
        alt: 'Manifest UI - Open Source Agentic UI Toolkit'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChatGPT apps shadcn/ui components - Manifest UI',
    description:
      'Beautifully designed components for building ChatGPT apps and agentic UIs. Built on top of shadcn/ui.',
    images: ['/og-image.webp', '/og-image.png']
  }
}

// JSON-LD Structured Data for rich search results
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Manifest UI',
  description:
    'A collection of beautifully designed components for building ChatGPT apps and agentic UIs. Built on top of shadcn/ui.',
  url: 'https://ui.manifest.build',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://ui.manifest.build/blocks?block={search_term_string}'
    },
    'query-input': 'required name=search_term_string'
  },
  publisher: {
    '@type': 'Organization',
    name: 'Manifest',
    url: 'https://manifest.build',
    logo: {
      '@type': 'ImageObject',
      url: 'https://ui.manifest.build/logo-manifest-ui.svg'
    }
  },
  sameAs: [
    'https://github.com/mnfst/manifest',
    'https://discord.gg/manifest'
  ]
}

const softwareApplicationData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Manifest UI',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  },
  description:
    'A collection of beautifully designed React components for building ChatGPT apps and agentic UIs. Built on top of shadcn/ui.',
  downloadUrl: 'https://github.com/mnfst/manifest',
  softwareVersion: '1.0.0',
  author: {
    '@type': 'Organization',
    name: 'Manifest'
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationData)
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          <main>{children}</main>
          <Footer />
        </ThemeProvider>
        <Analytics />
        <Script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="eKhcgmrsfM4C1k60A3/UTQ"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
