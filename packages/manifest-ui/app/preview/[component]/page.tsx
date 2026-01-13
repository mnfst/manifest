'use client'

import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import { previewComponents } from '@/lib/preview-components'
import { getPreviewBackground, PREVIEW_PADDING } from '@/lib/preview-backgrounds'

/**
 * Preview page for generating component screenshots.
 * This page renders a single component in isolation with a colorful gradient background.
 *
 * Usage: /preview/[component-name]
 * Example: /preview/message-bubble
 *
 * The page signals readiness for screenshot via a data attribute on the container.
 */
export default function PreviewPage() {
  const params = useParams()
  const componentName = params.component as string

  const config = previewComponents[componentName]

  if (!config) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-100"
        data-preview-ready="error"
        data-preview-component={componentName}
      >
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Component Not Found</h1>
          <p className="text-gray-600">No preview available for: {componentName}</p>
        </div>
      </div>
    )
  }

  const background = getPreviewBackground(config.category)

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: background.gradient,
        padding: PREVIEW_PADDING
      }}
      data-preview-ready="true"
      data-preview-component={componentName}
      data-preview-category={config.category}
    >
      <Suspense
        fallback={
          <div className="animate-pulse bg-white/20 rounded-lg w-96 h-64" />
        }
      >
        <div className="bg-background rounded-xl shadow-2xl overflow-hidden max-w-full">
          <div className="p-6">
            {config.component}
          </div>
        </div>
      </Suspense>
    </div>
  )
}
