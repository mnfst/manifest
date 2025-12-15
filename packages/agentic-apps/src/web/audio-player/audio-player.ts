// Types
interface OpenAI {
  theme?: 'light' | 'dark'
  toolInput?: { audioUrl?: string }
  toolOutput?: { audioUrl?: string }
}

declare global {
  interface Window {
    openai?: OpenAI
  }
}

// DOM elements
const containerEl = document.querySelector('.container') as HTMLElement
const audioEl = document.getElementById('audio') as HTMLAudioElement
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

// Load audio
function loadAudio(url: string) {
  audioEl.src = url

  audioEl.addEventListener('loadeddata', () => {
    loadingEl.style.display = 'none'
    containerEl.style.display = 'block'
  }, { once: true })

  audioEl.addEventListener('error', () => {
    showError(`Failed to load audio: ${audioEl.error?.message ?? 'Unknown error'}`)
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

  let audioUrl: string | null = null

  const openai = await waitForOpenAI()
  if (openai?.toolInput?.audioUrl) {
    audioUrl = openai.toolInput.audioUrl
  } else if (openai?.toolOutput?.audioUrl) {
    audioUrl = openai.toolOutput.audioUrl
  }

  if (!audioUrl) {
    const params = new URLSearchParams(window.location.search)
    audioUrl = params.get('url') ?? params.get('audioUrl')
  }

  if (audioUrl) {
    loadAudio(audioUrl)
  } else {
    showError('No audio URL provided')
  }
}

init()
