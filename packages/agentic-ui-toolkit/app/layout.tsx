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
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Manifest UI - Open Source Agentic UI Toolkit'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChatGPT apps shadcn/ui components - Manifest UI',
    description:
      'Beautifully designed components for building ChatGPT apps and agentic UIs. Built on top of shadcn/ui.',
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
