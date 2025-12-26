import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs'

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs'

// Types
interface OpenAI {
  theme?: 'light' | 'dark'
  toolInput?: { pdfUrl?: string }
  toolOutput?: { pdfUrl?: string }
  getWidgetState?: () => Promise<{ pdfUrl?: string }>
}

declare global {
  interface Window {
    openai?: OpenAI
  }
}

// DOM elements
const canvas = document.getElementById('pdf-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement
const nextBtn = document.getElementById('next-btn') as HTMLButtonElement
const pageNumEl = document.getElementById('page-num')!
const pageCountEl = document.getElementById('page-count')!
const loadingEl = document.getElementById('loading')!
const errorEl = document.getElementById('error')!
const viewerEl = document.querySelector('.viewer')!

// State
let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null
let currentPage = 1
let totalPages = 0
let scale = 1.5

// Apply theme
function applyTheme() {
  const theme = window.openai?.theme ?? 'light'
  document.body.classList.remove('light', 'dark')
  document.body.classList.add(theme)
}

// Show loading state
function showLoading(show: boolean) {
  loadingEl.style.display = show ? 'flex' : 'none'
  viewerEl.classList.toggle('hidden', show)
}

// Show error
function showError(message: string) {
  errorEl.textContent = message
  errorEl.style.display = 'flex'
  loadingEl.style.display = 'none'
}

// Render a page
async function renderPage(pageNum: number) {
  if (!pdfDoc) return

  const page = await pdfDoc.getPage(pageNum)
  const viewport = page.getViewport({ scale })

  canvas.height = viewport.height
  canvas.width = viewport.width

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise

  pageNumEl.textContent = String(pageNum)
  updateButtons()
}

// Update button states
function updateButtons() {
  prevBtn.disabled = currentPage <= 1
  nextBtn.disabled = currentPage >= totalPages
}

// Load PDF from URL
async function loadPdf(url: string) {
  showLoading(true)

  try {
    pdfDoc = await pdfjsLib.getDocument(url).promise
    totalPages = pdfDoc.numPages
    pageCountEl.textContent = String(totalPages)
    currentPage = 1
    showLoading(false)
    await renderPage(currentPage)
  } catch (err) {
    showError(
      `Failed to load PDF: ${
        err instanceof Error ? err.message : 'Unknown error'
      }`
    )
  }
}

// Navigation handlers
prevBtn.addEventListener('click', async () => {
  if (currentPage > 1) {
    currentPage--
    await renderPage(currentPage)
  }
})

nextBtn.addEventListener('click', async () => {
  if (currentPage < totalPages) {
    currentPage++
    await renderPage(currentPage)
  }
})

// Keyboard navigation
document.addEventListener('keydown', async (e) => {
  if (e.key === 'ArrowLeft' && currentPage > 1) {
    currentPage--
    await renderPage(currentPage)
  } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
    currentPage++
    await renderPage(currentPage)
  }
})

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

  let pdfUrl: string | null = null

  // Wait for openai to be available and get PDF URL
  const openai = await waitForOpenAI()
  if (openai?.toolInput?.pdfUrl) {
    pdfUrl = openai.toolInput.pdfUrl
  } else if (openai?.toolOutput?.pdfUrl) {
    pdfUrl = openai.toolOutput.pdfUrl
  }

  // Fallback to query params for local testing
  if (!pdfUrl) {
    const params = new URLSearchParams(window.location.search)
    pdfUrl = params.get('url') ?? params.get('pdfUrl')
  }

  if (pdfUrl) {
    await loadPdf(pdfUrl)
  } else {
    showError('No PDF URL provided')
  }
}

init()
