/**
 * Replace External URLs Script
 *
 * This script replaces all external asset URLs with local paths.
 *
 * Usage: node scripts/replace-external-urls.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_PATH = resolve(__dirname, '..')

const DRY_RUN = process.argv.includes('--dry-run')

// Mapping of Unsplash photo IDs to local filenames
const UNSPLASH_MAPPING = {
  '1633356122544-f134324a6cee': 'tech-react',
  '1559028012-481c04fa702d': 'tech-ux',
  '1558494949-ef010cbdcc31': 'tech-cloud',
  '1556742049-0cfed4f6a45d': 'tech-ecommerce',
  '1552664730-d307ca884978': 'tech-team',
  '1573164713988-8665fc963095': 'tech-women',
  '1551288049-bebda4e38f71': 'tech-dashboard',
  '1516321318423-f06f85e504b3': 'tech-remote',
  '1555066931-4365d14bab8c': 'tech-code',
  '1460925895917-afdab827c52f': 'tech-seo',
  '1504639725590-34d0984388bd': 'tech-debug',
  '1526304640581-d334cdbbf45e': 'tech-marketing',
  '1512941937669-90a1b58e7e9c': 'tech-mobile',
  '1558655146-d09347e92766': 'tech-design',
  '1470225620780-dba8ba36b745': 'event-music',
  '1585699324551-f6c309eedeca': 'event-comedy',
  '1504609813442-a8924e83f76e': 'event-yoga',
  '1545205597-3d9d02c29597': 'event-wellness',
  '1546519638-68e109498ffc': 'event-basketball',
  '1555939594-58d7cb561ad1': 'event-food',
  '1531243269054-5ebf6f34081e': 'event-wine',
  '1514320291840-2e0a9bf2a9ae': 'event-jazz',
  '1571266028243-e4733b0f0bb0': 'event-rooftop',
  '1527224538127-2104bb71c51b': 'event-art',
  '1506157786151-b8491531f063': 'event-concert',
  '1489599849927-2ee91cede3ba': 'event-movie',
  '1566577739112-5180d4bf9390': 'event-salsa',
  '1510812431401-41d2bd2722f3': 'event-tasting',
  '1506126613408-eca07ce68773': 'event-meditation',
  '1514525253161-7a46d19cd819': 'event-edm',
  '1533174072545-7a4b6ad7a6c3': 'event-festival',
  '1620712943543-bcc4688e7485': 'tech-ai',
  '1540575467063-178a50c2df87': 'event-conference',
  '1506905925346-21bda4d32df4': 'nature-mountain',
  '1677442136019-21780ecad995': 'tech-ai-2',
  '1459749411175-04bf5292ceea': 'event-summer',
  // Hotel images
  '1566073771259-6a8506099945': 'hotel-1',
  '1551882547-ff40c63fe5fa': 'hotel-2',
  '1542314831-068cd1dbfeeb': 'hotel-3',
  '1578683010236-d716f9a3f461': 'hotel-4',
  '1564501049412-61c2a3083791': 'hotel-5',
  '1571896349842-33c89424de2d': 'hotel-6',
  '1582719478250-c89cae4dc85b': 'hotel-7',
  '1590490360182-c33d57733427': 'hotel-8',
  // Homepage images
  '1549317661-bd32c8ce0db2': 'blog-cover-1',
  '1611162617474-5b21e879e113': 'blog-cover-2',
  '1621761191319-c6fb62004040': 'blog-cover-3',
  '1590658268037-6bf12165a8df': 'product-1',
  '1606220945770-b5b6c2c55bf1': 'product-2',
  '1505740420928-5e560c06d30e': 'product-3',
  '1572569511254-d8f925fe2cbb': 'product-4',
  '1631867675167-90a456a90863': 'product-5',
  '1546435770-a3e426bf472b': 'product-6',
  '1618477388954-7852f32655ec': 'thumbnail-1',
  '1682687220742-aba13b6e50ba': 'thumbnail-2',
  '1551650975-87deedd944c3': 'thumbnail-3',
}

function getAllSourceFiles(dir, extensions = ['.tsx', '.ts']) {
  const files = []
  if (!existsSync(dir)) return files

  const entries = readdirSync(dir)
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue

    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      files.push(...getAllSourceFiles(fullPath, extensions))
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath)
    }
  }

  return files
}

function replacePravatarUrls(content) {
  // Pattern: https://i.pravatar.cc/{size}?u={user}
  const pattern = /https:\/\/i\.pravatar\.cc\/(\d+)\?u=([^'"\s&]+)/g

  return content.replace(pattern, (match, size, user) => {
    return `/demo/avatars/${user}-${size}.jpg`
  })
}

function replaceUnsplashUrls(content) {
  // Pattern: https://images.unsplash.com/photo-{id}?...
  const pattern = /https:\/\/images\.unsplash\.com\/photo-([a-zA-Z0-9_-]+)(\?[^'"]*)?/g

  return content.replace(pattern, (match, id) => {
    const localName = UNSPLASH_MAPPING[id]
    if (localName) {
      return `/demo/images/${localName}.jpg`
    }
    console.warn(`  Warning: No mapping for Unsplash ID: ${id}`)
    return match
  })
}

function processFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  let newContent = content

  newContent = replacePravatarUrls(newContent)
  newContent = replaceUnsplashUrls(newContent)

  if (content !== newContent) {
    const relativePath = filePath.replace(ROOT_PATH + '/', '')

    if (DRY_RUN) {
      console.log(`Would update: ${relativePath}`)
    } else {
      writeFileSync(filePath, newContent)
      console.log(`Updated: ${relativePath}`)
    }

    return true
  }

  return false
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN - No files will be modified\n' : '')
  console.log('Replacing external URLs with local paths...\n')

  const sourceFiles = [
    ...getAllSourceFiles(join(ROOT_PATH, 'registry')),
    ...getAllSourceFiles(join(ROOT_PATH, 'app')),
    ...getAllSourceFiles(join(ROOT_PATH, 'lib')),
  ]

  console.log(`Found ${sourceFiles.length} source files to process\n`)

  let updatedCount = 0

  for (const file of sourceFiles) {
    const updated = processFile(file)
    if (updated) updatedCount++
  }

  console.log(`\n=== Summary ===`)
  console.log(`${DRY_RUN ? 'Would update' : 'Updated'}: ${updatedCount} files`)

  if (DRY_RUN && updatedCount > 0) {
    console.log('\nRun without --dry-run to apply changes.')
  }
}

main().catch(console.error)
