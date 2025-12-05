'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

export interface Product {
  id: string
  name: string
  description?: string
  price: number
  originalPrice?: number
  image?: string
  rating?: number
  badge?: string
  inStock?: boolean
}

export interface InlineProductCarouselProps {
  products?: Product[]
  currency?: string
  onSelectProduct?: (product: Product) => void
  selectedProductId?: string
}

const defaultProducts: Product[] = [
  {
    id: '1',
    name: "Air Force 1 '07",
    description: 'Nike',
    price: 119,
    image: '/demo/shoe-1.png',
    rating: 4.9,
    badge: 'New',
    inStock: true
  },
  {
    id: '2',
    name: 'Air Max 90',
    description: 'Nike',
    price: 140,
    image: '/demo/shoe-2.png',
    rating: 4.8,
    inStock: true
  },
  {
    id: '3',
    name: 'Air Max Plus',
    description: 'Nike',
    price: 170,
    originalPrice: 190,
    image: '/demo/shoe-4.png',
    rating: 4.7,
    badge: '-10%',
    inStock: true
  },
  {
    id: '4',
    name: 'Dunk Low',
    description: 'Nike',
    price: 115,
    image: '/demo/shoe-3.png',
    rating: 4.6,
    inStock: true
  },
  {
    id: '5',
    name: 'Air Force 1 Low',
    description: 'Nike',
    price: 110,
    originalPrice: 125,
    image: '/demo/shoe-1.png',
    rating: 4.8,
    badge: '-12%',
    inStock: true
  },
  {
    id: '6',
    name: 'Air Max 90 Premium',
    description: 'Nike',
    price: 160,
    image: '/demo/shoe-2.png',
    rating: 4.5,
    inStock: true
  }
]

// Desktop card dimensions
const CARD_WIDTH = 160
const GAP = 12

export function InlineProductCarousel({
  products = defaultProducts,
  currency = 'EUR',
  onSelectProduct,
  selectedProductId
}: InlineProductCarouselProps) {
  const [selected, setSelected] = useState<string | undefined>(
    selectedProductId
  )
  const [currentIndex, setCurrentIndex] = useState(0)

  const maxIndex = Math.max(0, products.length - 1)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(value)
  }

  const handleSelect = (product: Product) => {
    setSelected(product.id)
    onSelectProduct?.(product)
  }

  const goLeft = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const goRight = () => {
    if (currentIndex < maxIndex) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const currentProduct = products[currentIndex]
  const nextProduct = products[currentIndex + 1]

  // Desktop transform
  const desktopTransform = currentIndex * (CARD_WIDTH + GAP)

  return (
    <div className="w-full">
      {/* Mobile: 1 card */}
      <div className="sm:hidden flex items-center gap-2">
        <button
          type="button"
          onClick={goLeft}
          disabled={currentIndex === 0}
          className={cn(
            'flex-shrink-0 h-7 w-7 rounded-full bg-background border shadow-sm flex items-center justify-center',
            currentIndex === 0 ? 'opacity-30' : 'hover:bg-muted'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          {currentProduct && (
            <button
              type="button"
              onClick={() => handleSelect(currentProduct)}
              disabled={!currentProduct.inStock}
              className={cn(
                'w-full rounded-[12px] border text-left transition-all',
                'flex items-center gap-3 p-2',
                selected === currentProduct.id
                  ? 'bg-card border-foreground shadow-[0_0_0_1px] shadow-foreground'
                  : 'bg-card border-border hover:border-foreground/50',
                !currentProduct.inStock && 'opacity-50'
              )}
            >
              <div className="relative h-16 w-16 flex-shrink-0 rounded overflow-hidden bg-muted/30">
                {currentProduct.image && (
                  <img
                    src={currentProduct.image}
                    alt={currentProduct.name}
                    className="h-full w-full object-contain"
                  />
                )}
                {currentProduct.badge && (
                  <span
                    className={cn(
                      'absolute top-1 left-1 px-1 py-0.5 text-[8px] font-medium rounded',
                      currentProduct.badge.startsWith('-')
                        ? 'bg-foreground text-background'
                        : 'bg-background text-foreground border'
                    )}
                  >
                    {currentProduct.badge}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentProduct.name}</p>
                {currentProduct.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {currentProduct.description}
                  </p>
                )}
                <p className="text-sm font-semibold">
                  {formatCurrency(currentProduct.price)}
                </p>
              </div>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={goRight}
          disabled={currentIndex >= maxIndex}
          className={cn(
            'flex-shrink-0 h-7 w-7 rounded-full bg-background border shadow-sm flex items-center justify-center',
            currentIndex >= maxIndex ? 'opacity-30' : 'hover:bg-muted'
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Tablet: 2 cards */}
      <div className="hidden sm:flex lg:hidden items-center gap-2">
        <button
          type="button"
          onClick={goLeft}
          disabled={currentIndex === 0}
          className={cn(
            'flex-shrink-0 h-8 w-8 rounded-full bg-background border shadow-sm flex items-center justify-center',
            currentIndex === 0 ? 'opacity-30' : 'hover:bg-muted'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0 flex gap-2">
          {currentProduct && (
            <button
              type="button"
              onClick={() => handleSelect(currentProduct)}
              disabled={!currentProduct.inStock}
              className={cn(
                'flex-1 min-w-0 rounded-[12px] border text-left transition-all',
                'flex items-center gap-3 p-2',
                selected === currentProduct.id
                  ? 'bg-card border-foreground shadow-[0_0_0_1px] shadow-foreground'
                  : 'bg-card border-border hover:border-foreground/50',
                !currentProduct.inStock && 'opacity-50'
              )}
            >
              <div className="relative h-16 w-16 flex-shrink-0 rounded overflow-hidden bg-muted/30">
                {currentProduct.image && (
                  <img
                    src={currentProduct.image}
                    alt={currentProduct.name}
                    className="h-full w-full object-contain"
                  />
                )}
                {currentProduct.badge && (
                  <span
                    className={cn(
                      'absolute top-1 left-1 px-1 py-0.5 text-[8px] font-medium rounded',
                      currentProduct.badge.startsWith('-')
                        ? 'bg-foreground text-background'
                        : 'bg-background text-foreground border'
                    )}
                  >
                    {currentProduct.badge}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentProduct.name}</p>
                {currentProduct.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {currentProduct.description}
                  </p>
                )}
                <p className="text-sm font-semibold">
                  {formatCurrency(currentProduct.price)}
                </p>
              </div>
            </button>
          )}
          {nextProduct && (
            <button
              type="button"
              onClick={() => handleSelect(nextProduct)}
              disabled={!nextProduct.inStock}
              className={cn(
                'flex-1 min-w-0 rounded-[12px] border text-left transition-all',
                'flex items-center gap-3 p-2',
                selected === nextProduct.id
                  ? 'bg-card border-foreground shadow-[0_0_0_1px] shadow-foreground'
                  : 'bg-card border-border hover:border-foreground/50',
                !nextProduct.inStock && 'opacity-50'
              )}
            >
              <div className="relative h-16 w-16 flex-shrink-0 rounded overflow-hidden bg-muted/30">
                {nextProduct.image && (
                  <img
                    src={nextProduct.image}
                    alt={nextProduct.name}
                    className="h-full w-full object-contain"
                  />
                )}
                {nextProduct.badge && (
                  <span
                    className={cn(
                      'absolute top-1 left-1 px-1 py-0.5 text-[8px] font-medium rounded',
                      nextProduct.badge.startsWith('-')
                        ? 'bg-foreground text-background'
                        : 'bg-background text-foreground border'
                    )}
                  >
                    {nextProduct.badge}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{nextProduct.name}</p>
                {nextProduct.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {nextProduct.description}
                  </p>
                )}
                <p className="text-sm font-semibold">
                  {formatCurrency(nextProduct.price)}
                </p>
              </div>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={goRight}
          disabled={currentIndex >= maxIndex - 1}
          className={cn(
            'flex-shrink-0 h-8 w-8 rounded-full bg-background border shadow-sm flex items-center justify-center',
            currentIndex >= maxIndex - 1 ? 'opacity-30' : 'hover:bg-muted'
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Desktop: multi-card carousel */}
      <div className="hidden lg:block relative">
        <button
          type="button"
          onClick={goLeft}
          disabled={currentIndex === 0}
          className={cn(
            'absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center',
            currentIndex === 0 ? 'opacity-0' : 'hover:bg-background'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={goRight}
          disabled={currentIndex >= maxIndex}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center',
            currentIndex >= maxIndex ? 'opacity-0' : 'hover:bg-background'
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="overflow-hidden">
          <div
            className="flex gap-3 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${desktopTransform}px)` }}
          >
            {products.map((product) => (
              <button
                type="button"
                key={product.id}
                onClick={() => handleSelect(product)}
                disabled={!product.inStock}
                className={cn(
                  'flex-shrink-0 w-40 rounded-[12px] border text-left transition-all',
                  selected === product.id
                    ? 'bg-card border-foreground shadow-[0_0_0_1px] shadow-foreground'
                    : 'bg-card border-border hover:border-foreground/50',
                  !product.inStock && 'opacity-50'
                )}
              >
                <div className="relative h-28 w-full bg-muted/30">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  )}
                  {product.badge && (
                    <span
                      className={cn(
                        'absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-medium rounded',
                        product.badge.startsWith('-')
                          ? 'bg-foreground text-background'
                          : 'bg-background text-foreground border'
                      )}
                    >
                      {product.badge}
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-medium truncate">{product.name}</p>
                  {product.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {product.description}
                    </p>
                  )}
                  <p className="text-sm font-semibold">
                    {formatCurrency(product.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
