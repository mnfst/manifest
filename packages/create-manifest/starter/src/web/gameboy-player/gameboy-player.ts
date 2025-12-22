// Types
interface GameboyToolOutput {
  romUrl: string
  fileId: string
}

interface OpenAI {
  theme?: 'light' | 'dark'
  toolOutput?: unknown
}

// GameboyJS library types (from external script)
interface RomData {
  data: Uint8Array
}

interface GameboyJSInstance {
  startRom: (rom: RomData) => void
  pause: (value: boolean) => void
  setSoundEnabled: (value: boolean) => void
}

interface GameboyJSOptions {
  pad?: { class: unknown; mapping?: Record<string, string> | null }
  zoom?: number
  romReaders?: unknown[]
  statusContainerId?: string
  gameNameContainerId?: string
  errorContainerId?: string
}

interface GameboyJSConstructor {
  new (canvas: HTMLCanvasElement, options?: GameboyJSOptions): GameboyJSInstance
}

declare global {
  interface Window {
    openai?: OpenAI
    GameboyJS?: {
      Gameboy: GameboyJSConstructor
      Keyboard: unknown
    }
  }
}

// DOM elements
const canvas = document.getElementById('gameboy-screen') as HTMLCanvasElement
const screenOverlay = document.getElementById('screen-overlay')!
const loadingText = document.getElementById('loading-text')!
const errorEl = document.getElementById('error')!

let gameboy: GameboyJSInstance | null = null

// Show error
function showError(message: string) {
  errorEl.textContent = message
  errorEl.style.display = 'flex'
  screenOverlay.classList.add('hidden')
}

// Hide loading overlay
function hideLoading() {
  screenOverlay.classList.add('hidden')
}

// Validate tool output
function isValidOutput(data: unknown): data is GameboyToolOutput {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return typeof obj.romUrl === 'string' && typeof obj.fileId === 'string'
}

// Fetch ROM as ArrayBuffer
async function fetchRom(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ROM: ${response.status} ${response.statusText}`)
  }
  return response.arrayBuffer()
}

// Initialize gameboy emulator
async function initGameboy(romUrl: string) {
  if (!window.GameboyJS) {
    showError('GameBoy emulator library failed to load')
    return
  }

  try {
    loadingText.textContent = 'Downloading ROM...'
    const romData = await fetchRom(romUrl)

    loadingText.textContent = 'Starting emulator...'

    // Create gameboy instance with keyboard controls
    gameboy = new window.GameboyJS.Gameboy(canvas, {
      pad: { class: window.GameboyJS.Keyboard, mapping: null },
      zoom: 2,
      romReaders: [],
      statusContainerId: 'nonexistent',
      gameNameContainerId: 'nonexistent',
      errorContainerId: 'nonexistent'
    })

    // Convert to Uint8Array and start the ROM
    const romArray = new Uint8Array(romData)
    gameboy.startRom({ data: romArray })

    hideLoading()
  } catch (err) {
    console.error('Failed to load ROM:', err)
    showError(err instanceof Error ? err.message : 'Failed to load ROM')
  }
}

// Wait for tool output
function waitForToolOutput(timeout = 10000): Promise<GameboyToolOutput | undefined> {
  return new Promise((resolve) => {
    if (window.openai?.toolOutput && isValidOutput(window.openai.toolOutput)) {
      resolve(window.openai.toolOutput)
      return
    }

    const start = Date.now()
    const check = () => {
      const output = window.openai?.toolOutput
      if (output && isValidOutput(output)) {
        resolve(output)
      } else if (Date.now() - start > timeout) {
        resolve(undefined)
      } else {
        setTimeout(check, 100)
      }
    }
    check()
  })
}

// Wait for GameboyJS library to load
function waitForGameboyJS(timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.GameboyJS) {
      resolve(true)
      return
    }

    const start = Date.now()
    const check = () => {
      if (window.GameboyJS) {
        resolve(true)
      } else if (Date.now() - start > timeout) {
        resolve(false)
      } else {
        setTimeout(check, 50)
      }
    }
    check()
  })
}

// Main initialization
async function init() {
  // Wait for the GameboyJS library to load
  const libLoaded = await waitForGameboyJS()
  if (!libLoaded) {
    showError('Failed to load GameBoy emulator library')
    return
  }

  // Wait for tool output
  const output = await waitForToolOutput()

  if (!output) {
    showError('No ROM provided. Please upload a GameBoy ROM file (.gb or .gbc)')
    return
  }

  await initGameboy(output.romUrl)
}

init()
