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
    name: 'Iyo Pro',
    description: 'Premium Earbuds',
    price: 299,
    image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=400&h=400&fit=crop',
    rating: 4.9,
    badge: 'Best Seller',
    inStock: true
  },
  {
    id: '2',
    name: 'Iyo Air',
    description: 'Wireless Earbuds',
    price: 149,
    image: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400&h=400&fit=crop',
    rating: 4.8,
    badge: 'New',
    inStock: true
  },
  {
    id: '3',
    name: 'Iyo Studio',
    description: 'Over-Ear Headphones',
    price: 349,
    originalPrice: 399,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    rating: 4.7,
    badge: '-12%',
    inStock: true
  },
  {
    id: '4',
    name: 'Iyo Sport',
    description: 'Active Earbuds',
    price: 199,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop',
    rating: 4.8,
    inStock: true
  },
  {
    id: '5',
    name: 'Iyo Mini',
    description: 'Compact Earbuds',
    price: 99,
    originalPrice: 129,
    image: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&h=400&fit=crop',
    rating: 4.6,
    badge: '-23%',
    inStock: true
  },
  {
    id: '6',
    name: 'Iyo Max',
    description: 'Premium Headphones',
    price: 449,
    image: 'https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?w=400&h=400&fit=crop',
    rating: 4.9,
    inStock: true
  }
]

// Desktop card dimensions
const CARD_WIDTH = 160
const GAP = 12

export function InlineProductCarousel({
  products = defaultProducts,
  currency = 'USD',
  onSelectProduct,
  selectedProductId
}: InlineProductCarouselProps) {
  const [selected, setSelected] = useState<string | undefined>(
    selectedProductId
  )
  const [currentIndex, setCurrentIndex] = useState(0)

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

  // Desktop transform
  const desktopTransform = currentIndex * (CARD_WIDTH + GAP)

  // Tablet max index (showing 2 cards at a time)
  const tabletMaxIndex = Math.max(0, products.length - 2)

  // Horizontal card component for mobile/tablet
  const HorizontalCard = ({ product }: { product: Product }) => (
    <button
      type="button"
      onClick={() => handleSelect(product)}
      disabled={!product.inStock}
      className={cn(
        'w-full rounded-[12px] border text-left',
        'flex items-center gap-3 p-2',
        selected === product.id
          ? 'bg-card border-foreground shadow-[0_0_0_1px] shadow-foreground'
          : 'bg-card border-border hover:border-foreground/50',
        !product.inStock && 'opacity-50'
      )}
    >
      <div className="relative h-16 w-16 flex-shrink-0 rounded overflow-hidden bg-muted/30">
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
              'absolute top-1 left-1 px-1 py-0.5 text-[8px] font-medium rounded',
              product.badge.startsWith('-')
                ? 'bg-foreground text-background'
                : 'bg-background text-foreground border'
            )}
          >
            {product.badge}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{product.name}</p>
        {product.description && (
          <p className="text-xs text-muted-foreground truncate">
            {product.description}
          </p>
        )}
        <p className="text-sm font-semibold">{formatCurrency(product.price)}</p>
      </div>
    </button>
  )

  // Dots component
  const Dots = ({ count, active, onDotClick }: { count: number; active: number; onDotClick: (i: number) => void }) => (
    <div className="flex justify-center gap-1.5 mt-3">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onDotClick(i)}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === active ? 'w-4 bg-foreground' : 'w-1.5 bg-foreground/30 hover:bg-foreground/50'
          )}
        />
      ))}
    </div>
  )

  // Get visible products for mobile (1 card) and tablet (2 cards)
  const mobileProduct = products[currentIndex]
  const tabletProducts = [
    products[Math.min(currentIndex, tabletMaxIndex)],
    products[Math.min(currentIndex, tabletMaxIndex) + 1]
  ].filter(Boolean)

  return (
    <div className="w-full">
      {/* Mobile: 1 card + dots */}
      <div className="sm:hidden px-0.5">
        <div
          key={currentIndex}
          className="w-full animate-in fade-in slide-in-from-right-4 duration-300"
        >
          {mobileProduct && <HorizontalCard product={mobileProduct} />}
        </div>
        <Dots
          count={products.length}
          active={currentIndex}
          onDotClick={(i) => setCurrentIndex(i)}
        />
      </div>

      {/* Tablet: 2 cards + dots */}
      <div className="hidden sm:block lg:hidden px-0.5">
        <div
          key={Math.min(currentIndex, tabletMaxIndex)}
          className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-right-4 duration-300"
        >
          {tabletProducts.map((product) => (
            <HorizontalCard key={product.id} product={product} />
          ))}
        </div>
        <Dots
          count={tabletMaxIndex + 1}
          active={Math.min(currentIndex, tabletMaxIndex)}
          onDotClick={(i) => setCurrentIndex(i)}
        />
      </div>

      {/* Desktop: multi-card carousel */}
      {(() => {
        // Desktop shows 4 cards, so max index is length - 4
        const desktopMaxIndex = Math.max(0, products.length - 4)
        const isAtEnd = currentIndex >= desktopMaxIndex
        return (
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
              onClick={() => {
                if (currentIndex < desktopMaxIndex) {
                  setCurrentIndex(currentIndex + 1)
                }
              }}
              disabled={isAtEnd}
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center',
                isAtEnd ? 'opacity-0' : 'hover:bg-background'
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="overflow-hidden py-1 -mx-1">
              <div
                className="flex gap-3 transition-transform duration-300 ease-out px-1"
                style={{ transform: `translateX(-${desktopTransform}px)` }}
              >
                {products.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => handleSelect(product)}
                    disabled={!product.inStock}
                    className={cn(
                      'flex-shrink-0 w-40 rounded-[12px] border text-left',
                      selected === product.id
                        ? 'bg-card border-foreground ring-1 ring-foreground'
                        : 'bg-card border-border hover:border-foreground/50',
                      !product.inStock && 'opacity-50'
                    )}
                  >
                    <div className="relative h-28 w-full bg-muted/30 rounded-t-[11px] overflow-hidden">
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
        )
      })()}
    </div>
  )
}
