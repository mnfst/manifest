import { Header } from '@/components/layout/header'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
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
  title: 'Manifest Agentic UI Toolkit',
  description:
    'Beautiful UI blocks for building conversational interfaces. Ready-to-use components for ChatGPT, Claude, and other AI assistants.',
  metadataBase: new URL('https://ui.manifest.build'),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' }
    ],
    apple: '/favicon.png'
  },
  openGraph: {
    title: 'Manifest Agentic UI Toolkit',
    description:
      'Beautiful UI blocks for building conversational interfaces. Ready-to-use components for ChatGPT, Claude, and other AI assistants.',
    url: 'https://ui.manifest.build',
    siteName: 'Manifest Agentic UI Toolkit',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Manifest UI - Open Source Agentic UI Toolkit'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Manifest Agentic UI Toolkit',
    description: 'Beautiful UI blocks for building conversational interfaces.',
    images: ['/og-image.png']
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
