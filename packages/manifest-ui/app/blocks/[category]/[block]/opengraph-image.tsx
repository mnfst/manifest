import { ImageResponse } from 'next/og'
import {
  getBlockName,
  getCategoryName,
  OG_GRADIENT,
  OG_IMAGE_SIZE
} from '@/lib/og-image-utils'

export const runtime = 'edge'

export const alt = 'Component Preview'
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'

export default async function Image({
  params
}: {
  params: Promise<{ category: string; block: string }>
}) {
  const { category, block } = await params

  const blockName = getBlockName(block)
  const categoryName = getCategoryName(category)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: OG_GRADIENT,
          padding: '60px'
        }}
      >
        {/* Main card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '24px',
            padding: '60px 80px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '900px'
          }}
        >
          {/* Category badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f0f0ff',
              color: '#6366f1',
              fontSize: '18px',
              fontWeight: 600,
              padding: '8px 20px',
              borderRadius: '999px',
              marginBottom: '24px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {categoryName}
          </div>

          {/* Component name */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 700,
              color: '#1a1a2e',
              textAlign: 'center',
              lineHeight: 1.2,
              marginBottom: '20px'
            }}
          >
            {blockName}
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '22px',
              color: '#6b7280',
              textAlign: 'center'
            }}
          >
            Ready-to-use React component for ChatGPT apps
          </div>
        </div>

        {/* Manifest UI branding at bottom */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '40px',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '20px',
            fontWeight: 500
          }}
        >
          ui.manifest.build
        </div>
      </div>
    ),
    {
      ...size
    }
  )
}
