'use client'

import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
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

export interface ProductListProps {
  products?: Product[]
  variant?: 'list' | 'grid' | 'carousel'
  currency?: string
  columns?: 3 | 4
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
    name: 'Jordan 1 Low',
    description: 'Nike',
    price: 135,
    image: '/demo/shoe-1.png',
    rating: 4.8,
    inStock: true
  },
  {
    id: '6',
    name: 'Blazer Mid',
    description: 'Nike',
    price: 105,
    image: '/demo/shoe-2.png',
    rating: 4.5,
    inStock: true
  }
]

// Horizontal card for list variant
function ProductHorizontalCard({
  product,
  selected,
  onSelect,
  formatCurrency
}: {
  product: Product
  selected: boolean
  onSelect: () => void
  formatCurrency: (value: number) => string
}) {
  return (
    <button
      onClick={onSelect}
      disabled={!product.inStock}
      className={cn(
        'w-full flex items-center gap-3 rounded-[12px] border p-2 text-left transition-all',
        selected
          ? 'bg-card border-foreground ring-1 ring-foreground'
          : 'bg-card border-border hover:border-foreground/50',
        !product.inStock && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="relative h-16 w-16 flex-shrink-0 rounded-md overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-contain bg-muted/30"
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        {product.badge && (
          <span
            className={cn(
              'absolute top-1 left-1 px-1 py-0.5 text-[8px] font-medium rounded',
              product.badge.startsWith('-')
                ? 'bg-foreground text-background'
                : 'bg-background text-foreground border border-border'
            )}
          >
            {product.badge}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium truncate">{product.name}</p>
        {product.description && (
          <p className="text-xs truncate text-muted-foreground">
            {product.description}
          </p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            {formatCurrency(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-xs line-through text-muted-foreground">
              {formatCurrency(product.originalPrice)}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    </button>
  )
}

// List variant
function ListVariant({
  products,
  selected,
  onSelect,
  formatCurrency
}: {
  products: Product[]
  selected: string | undefined
  onSelect: (product: Product) => void
  formatCurrency: (value: number) => string
}) {
  return (
    <div className="w-full space-y-2 p-1 sm:p-0">
      {products.slice(0, 4).map((product) => (
        <ProductHorizontalCard
          key={product.id}
          product={product}
          selected={selected === product.id}
          onSelect={() => onSelect(product)}
          formatCurrency={formatCurrency}
        />
      ))}
    </div>
  )
}

// Grid variant
function GridVariant({
  products,
  selected,
  onSelect,
  formatCurrency,
  columns
}: {
  products: Product[]
  selected: string | undefined
  onSelect: (product: Product) => void
  formatCurrency: (value: number) => string
  columns: 3 | 4
}) {
  const displayProducts = products.slice(0, columns)

  return (
    <div className="w-full p-1 sm:p-0">
      <div
        className={cn(
          'grid gap-2 sm:gap-3 grid-cols-2',
          columns === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
        )}
      >
        {displayProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelect(product)}
            disabled={!product.inStock}
            className={cn(
              'rounded-[12px] border text-left transition-all overflow-hidden',
              selected === product.id
                ? 'bg-card border-foreground ring-1 ring-foreground'
                : 'bg-card border-border hover:border-foreground/50',
              !product.inStock && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="relative">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="aspect-square lg:h-28 lg:aspect-auto w-full object-contain bg-muted/30"
                />
              ) : (
                <div className="aspect-square lg:h-28 lg:aspect-auto w-full bg-muted" />
              )}
              {product.badge && (
                <span
                  className={cn(
                    'absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-medium rounded',
                    product.badge.startsWith('-')
                      ? 'bg-foreground text-background'
                      : 'bg-background text-foreground border border-border'
                  )}
                >
                  {product.badge}
                </span>
              )}
            </div>
            <div className="p-2 sm:p-3 space-y-0.5 sm:space-y-1">
              <p className="text-xs sm:text-sm font-medium line-clamp-1">
                {product.name}
              </p>
              {product.description && (
                <p className="text-[10px] sm:text-xs line-clamp-1 text-muted-foreground">
                  {product.description}
                </p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs sm:text-sm font-semibold">
                    {formatCurrency(product.price)}
                  </span>
                  {product.originalPrice && (
                    <span className="text-[10px] sm:text-xs line-through text-muted-foreground">
                      {formatCurrency(product.originalPrice)}
                    </span>
                  )}
                </div>
                {product.rating && (
                  <div className="hidden sm:flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {product.rating}
                  </div>
                )}
              </div>
              {!product.inStock && (
                <p className="text-[10px] sm:text-xs text-destructive">
                  Out of stock
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Carousel variant
function CarouselVariant({
  products,
  selected,
  onSelect,
  formatCurrency
}: {
  products: Product[]
  selected: string | undefined
  onSelect: (product: Product) => void
  formatCurrency: (value: number) => string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const CARD_WIDTH = 160
  const GAP = 12
  const desktopTransform = currentIndex * (CARD_WIDTH + GAP)
  const tabletMaxIndex = Math.max(0, products.length - 2)

  const goLeft = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  // Horizontal card for mobile/tablet
  const HorizontalCard = ({ product }: { product: Product }) => (
    <button
      type="button"
      onClick={() => onSelect(product)}
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
  const Dots = ({
    count,
    active,
    onDotClick
  }: {
    count: number
    active: number
    onDotClick: (i: number) => void
  }) => (
    <div className="flex justify-center gap-1.5 mt-3">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onDotClick(i)}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === active
              ? 'w-4 bg-foreground'
              : 'w-1.5 bg-foreground/30 hover:bg-foreground/50'
          )}
        />
      ))}
    </div>
  )

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
                    onClick={() => onSelect(product)}
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
                      <p className="text-sm font-medium truncate">
                        {product.name}
                      </p>
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

export function ProductList({
  products = defaultProducts,
  variant = 'list',
  currency = 'EUR',
  columns = 4,
  onSelectProduct,
  selectedProductId
}: ProductListProps) {
  const [selected, setSelected] = useState<string | undefined>(selectedProductId)

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

  if (variant === 'grid') {
    return (
      <GridVariant
        products={products}
        selected={selected}
        onSelect={handleSelect}
        formatCurrency={formatCurrency}
        columns={columns}
      />
    )
  }

  if (variant === 'carousel') {
    return (
      <CarouselVariant
        products={products}
        selected={selected}
        onSelect={handleSelect}
        formatCurrency={formatCurrency}
      />
    )
  }

  return (
    <ListVariant
      products={products}
      selected={selected}
      onSelect={handleSelect}
      formatCurrency={formatCurrency}
    />
  )
}
