import PhotoSwipeLightbox from 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe-lightbox.esm.min.js'
import PhotoSwipe from 'https://cdn.jsdelivr.net/npm/photoswipe@5.4.4/dist/photoswipe.esm.min.js'

// Types
interface OpenAI {
  theme?: 'light' | 'dark'
  toolInput?: { imageUrl?: string }
  toolOutput?: { imageUrl?: string }
}

declare global {
  interface Window {
    openai?: OpenAI
  }
}

// DOM elements
const containerEl = document.querySelector('.container') as HTMLElement
const imgEl = document.getElementById('image') as HTMLImageElement
const loadingEl = document.getElementById('loading')!
const errorEl = document.getElementById('error')!

// Apply theme
function applyTheme() {
  const theme = window.openai?.theme ?? 'dark'
  document.body.classList.remove('light', 'dark')
  document.body.classList.add(theme)
}

// Show error
function showError(message: string) {
  errorEl.textContent = message
  errorEl.style.display = 'flex'
  loadingEl.style.display = 'none'
  containerEl.style.display = 'none'
}

// Load image
function loadImage(url: string) {
  imgEl.src = url
  const linkEl = document.getElementById('image-link') as HTMLAnchorElement
  linkEl.href = url

  imgEl.onload = () => {
    loadingEl.style.display = 'none'
    containerEl.style.display = 'flex'

    // Set dimensions for PhotoSwipe
    linkEl.dataset.pswpWidth = String(imgEl.naturalWidth)
    linkEl.dataset.pswpHeight = String(imgEl.naturalHeight)

    // Initialize PhotoSwipe lightbox
    const lightbox = new PhotoSwipeLightbox({
      gallery: '.container',
      children: 'a',
      pswpModule: PhotoSwipe
    })
    lightbox.init()
  }

  imgEl.onerror = () => {
    showError('Failed to load image')
  }
}

// Wait for openai to be available
function waitForOpenAI(timeout = 5000): Promise<typeof window.openai> {
  return new Promise((resolve) => {
    if (window.openai) {
      resolve(window.openai)
      return
    }

    const start = Date.now()
    const check = () => {
      if (window.openai) {
        resolve(window.openai)
      } else if (Date.now() - start > timeout) {
        resolve(undefined)
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}

// Initialize
async function init() {
  applyTheme()

  let imageUrl: string | null = null

  const openai = await waitForOpenAI()
  if (openai?.toolInput?.imageUrl) {
    imageUrl = openai.toolInput.imageUrl
  } else if (openai?.toolOutput?.imageUrl) {
    imageUrl = openai.toolOutput.imageUrl
  }

  if (!imageUrl) {
    const params = new URLSearchParams(window.location.search)
    imageUrl = params.get('url') ?? params.get('imageUrl')
  }

  if (imageUrl) {
    loadImage(imageUrl)
  } else {
    showError('No image URL provided')
  }
}

init()
