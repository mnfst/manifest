// Types
interface OpenAI {
  theme?: 'light' | 'dark'
  toolInput?: { videoUrl?: string }
  toolOutput?: { videoUrl?: string }
}

declare global {
  interface Window {
    openai?: OpenAI
  }
}

// DOM elements
const videoEl = document.getElementById('video') as HTMLVideoElement
const containerEl = document.querySelector('.container')!
const loadingEl = document.getElementById('loading')!
const errorEl = document.getElementById('error')!

// Apply theme
function applyTheme() {
  const theme = window.openai?.theme ?? 'dark'
  document.body.classList.remove('light', 'dark')
  document.body.classList.add(theme)
}

// Show loading state
function showLoading(show: boolean) {
  loadingEl.style.display = show ? 'flex' : 'none'
  containerEl.classList.toggle('hidden', show)
}

// Show error
function showError(message: string) {
  errorEl.textContent = message
  errorEl.style.display = 'flex'
  loadingEl.style.display = 'none'
  containerEl.classList.add('hidden')
}

// Load video from URL
function loadVideo(url: string) {
  showLoading(true)

  videoEl.src = url
  videoEl.load()

  videoEl.addEventListener('loadeddata', () => {
    showLoading(false)
  }, { once: true })

  videoEl.addEventListener('error', () => {
    showError(`Failed to load video: ${videoEl.error?.message ?? 'Unknown error'}`)
  }, { once: true })
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

  let videoUrl: string | null = null

  // Wait for openai to be available and get video URL
  const openai = await waitForOpenAI()
  if (openai?.toolInput?.videoUrl) {
    videoUrl = openai.toolInput.videoUrl
  } else if (openai?.toolOutput?.videoUrl) {
    videoUrl = openai.toolOutput.videoUrl
  }

  // Fallback to query params for local testing
  if (!videoUrl) {
    const params = new URLSearchParams(window.location.search)
    videoUrl = params.get('url') ?? params.get('videoUrl')
  }

  if (videoUrl) {
    loadVideo(videoUrl)
  } else {
    showError('No video URL provided')
  }
}

init()
