'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, ChevronLeft, ChevronRight, ShoppingCart, Star } from 'lucide-react'
import { useCallback, useState } from 'react'

// Import types from shared types file to avoid circular dependencies
import type { Product } from './types'
// Re-export for backward compatibility
export type { Product } from './types'

import { demoProducts } from './demo/list'


/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ProductListProps
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Props for configuring a versatile product list component with list, grid,
 * carousel, and picker variants.
 */
export interface ProductListProps {
  data?: {
    /** Array of products to display in the list. */
    products?: Product[]
  }
  actions?: {
    /** Called when a user selects a product from the list. */
    onSelectProduct?: (product: Product) => void
    /** Called when products are added to cart (picker variant only). */
    onAddToCart?: (products: Product[]) => void
  }
  appearance?: {
    /**
     * Layout variant for displaying products.
     * @default "list"
     */
    variant?: 'list' | 'grid' | 'carousel' | 'picker'
    /**
     * Currency code for price formatting (e.g., "USD", "EUR").
     * @default "EUR"
     */
    currency?: string
    /**
     * Number of columns for grid variant.
     * @default 4
     */
    columns?: 3 | 4
    /**
     * Custom label for the add to cart button (picker variant).
     * @default "Add to cart"
     */
    buttonLabel?: string
  }
  control?: {
    /** Index of the currently selected product. */
    selectedProductIndex?: number
  }
}

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
        'w-full flex items-center gap-3 rounded-[12px] border p-2 text-left transition-all cursor-pointer',
        selected
          ? 'bg-card border-foreground ring-1 ring-foreground'
          : 'bg-card border-border hover:border-foreground/50',
        !product.inStock && 'opacity-50 !cursor-not-allowed'
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
        {product.name && <p className="text-sm font-medium truncate">{product.name}</p>}
        {product.description && (
          <p className="text-xs truncate text-muted-foreground">
            {product.description}
          </p>
        )}
        <div className="flex items-center gap-2">
          {product.price !== undefined && (
            <span className="text-sm font-semibold">
              {formatCurrency(product.price)}
            </span>
          )}
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
  selected: number | undefined
  onSelect: (product: Product, index: number) => void
  formatCurrency: (value: number) => string
}) {
  return (
    <div className="w-full space-y-2 p-1 sm:p-0">
      {products.slice(0, 4).map((product, index) => (
        <ProductHorizontalCard
          key={index}
          product={product}
          selected={selected === index}
          onSelect={() => onSelect(product, index)}
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
  selected: number | undefined
  onSelect: (product: Product, index: number) => void
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
        {displayProducts.map((product, index) => (
          <button
            key={index}
            onClick={() => onSelect(product, index)}
            disabled={!product.inStock}
            className={cn(
              'rounded-[12px] border text-left transition-all overflow-hidden cursor-pointer',
              selected === index
                ? 'bg-card border-foreground ring-1 ring-foreground'
                : 'bg-card border-border hover:border-foreground/50',
              !product.inStock && 'opacity-50 !cursor-not-allowed'
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
              {product.name && (
                <p className="text-xs sm:text-sm font-medium line-clamp-1">
                  {product.name}
                </p>
              )}
              {product.description && (
                <p className="text-[10px] sm:text-xs line-clamp-1 text-muted-foreground">
                  {product.description}
                </p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  {product.price !== undefined && (
                    <span className="text-xs sm:text-sm font-semibold">
                      {formatCurrency(product.price)}
                    </span>
                  )}
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
  selected: number | undefined
  onSelect: (product: Product, index: number) => void
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
  const HorizontalCard = ({ product, index }: { product: Product; index: number }) => (
    <button
      type="button"
      onClick={() => onSelect(product, index)}
      disabled={!product.inStock}
      className={cn(
        'w-full rounded-[12px] border text-left cursor-pointer',
        'flex items-center gap-3 p-2',
        selected === index
          ? 'bg-card border-foreground shadow-[0_0_0_1px] shadow-foreground'
          : 'bg-card border-border hover:border-foreground/50',
        !product.inStock && 'opacity-50 !cursor-not-allowed'
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
        {product.name && <p className="text-sm font-medium truncate">{product.name}</p>}
        {product.description && (
          <p className="text-xs text-muted-foreground truncate">
            {product.description}
          </p>
        )}
        {product.price !== undefined && <p className="text-sm font-semibold">{formatCurrency(product.price)}</p>}
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
          aria-label={`Go to slide ${i + 1}`}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300 cursor-pointer',
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
          {mobileProduct && <HorizontalCard product={mobileProduct} index={currentIndex} />}
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
          {tabletProducts.map((product, i) => {
            const productIndex = Math.min(currentIndex, tabletMaxIndex) + i
            return <HorizontalCard key={productIndex} product={product} index={productIndex} />
          })}
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
              aria-label="Previous product"
              className={cn(
                'absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center cursor-pointer',
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
              aria-label="Next product"
              className={cn(
                'absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center cursor-pointer',
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
                {products.map((product, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => onSelect(product, index)}
                    disabled={!product.inStock}
                    className={cn(
                      'flex-shrink-0 w-40 rounded-[12px] border text-left cursor-pointer',
                      selected === index
                        ? 'bg-card border-foreground ring-1 ring-foreground'
                        : 'bg-card border-border hover:border-foreground/50',
                      !product.inStock && 'opacity-50 !cursor-not-allowed'
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
                      {product.name && (
                        <p className="text-sm font-medium truncate">
                          {product.name}
                        </p>
                      )}
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {product.description}
                        </p>
                      )}
                      {product.price !== undefined && (
                        <p className="text-sm font-semibold">
                          {formatCurrency(product.price)}
                        </p>
                      )}
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

// Picker variant (multi-select with add to cart)
function PickerVariant({
  products,
  formatCurrency,
  onAddToCart,
  buttonLabel = 'Add to cart'
}: {
  products: Product[]
  formatCurrency: (value: number) => string
  onAddToCart?: (products: Product[]) => void
  buttonLabel?: string
}) {
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set())

  const handleSelect = useCallback((index: number, product: Product) => {
    if (!product.inStock) return

    setSelectedIndexes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    const availableIndexes = products
      .map((p, i) => (p.inStock ? i : -1))
      .filter((i) => i !== -1)
    const allSelected = availableIndexes.every((i) => selectedIndexes.has(i))

    if (allSelected) {
      setSelectedIndexes(new Set())
    } else {
      setSelectedIndexes(new Set(availableIndexes))
    }
  }, [products, selectedIndexes])

  const handleAddToCart = useCallback(() => {
    const selectedProducts = products.filter((_, i) => selectedIndexes.has(i))
    onAddToCart?.(selectedProducts)
  }, [products, selectedIndexes, onAddToCart])

  const availableIndexes = products
    .map((p, i) => (p.inStock ? i : -1))
    .filter((i) => i !== -1)
  const allSelected =
    availableIndexes.length > 0 &&
    availableIndexes.every((i) => selectedIndexes.has(i))

  const totalPrice = products
    .filter((_, i) => selectedIndexes.has(i))
    .reduce((sum, p) => sum + (p.price ?? 0), 0)

  return (
    <div className="w-full space-y-3 rounded-md sm:rounded-lg p-4 sm:p-0">
      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-2 px-0.5">
        {products.map((product, index) => (
          <button
            key={index}
            type="button"
            onClick={() => handleSelect(index, product)}
            disabled={!product.inStock}
            className={cn(
              'w-full flex items-center gap-3 rounded-md sm:rounded-lg border bg-card p-2 text-left transition-all cursor-pointer',
              selectedIndexes.has(index)
                ? 'border-foreground ring-1 ring-foreground'
                : 'border-border hover:border-foreground/30',
              !product.inStock && 'opacity-50 !cursor-not-allowed'
            )}
          >
            {/* Checkbox */}
            <div
              className={cn(
                'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
                selectedIndexes.has(index)
                  ? 'bg-foreground border-foreground text-background'
                  : 'border-border'
              )}
            >
              {selectedIndexes.has(index) && <Check className="h-3 w-3" />}
            </div>

            {/* Image */}
            <div className="h-12 w-12 flex-shrink-0 rounded overflow-hidden bg-muted/30">
              {product.image && (
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {product.name && <p className="text-sm font-medium truncate">{product.name}</p>}
              {product.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {product.description}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="text-right flex-shrink-0">
              {product.price !== undefined && (
                <p className="text-sm font-semibold">
                  {formatCurrency(product.price)}
                </p>
              )}
              {product.originalPrice && (
                <p className="text-xs text-muted-foreground line-through">
                  {formatCurrency(product.originalPrice)}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Desktop: Table view */}
      <div className="hidden sm:block overflow-x-auto rounded-md sm:rounded-lg mb-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="w-10 px-3 py-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                    allSelected
                      ? 'bg-foreground border-foreground text-background'
                      : 'border-border hover:border-foreground/50'
                  )}
                  aria-label="Select all products"
                >
                  {allSelected && <Check className="h-3 w-3" />}
                </button>
              </th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                Product
              </th>
              <th className="px-3 py-3 text-right font-medium text-muted-foreground">
                Price
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr
                key={index}
                onClick={() => handleSelect(index, product)}
                className={cn(
                  'border-b border-border last:border-0 transition-colors',
                  product.inStock
                    ? 'cursor-pointer hover:bg-muted/30'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                <td className="px-3 py-3">
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                      selectedIndexes.has(index)
                        ? 'bg-foreground border-foreground text-background'
                        : 'border-border'
                    )}
                  >
                    {selectedIndexes.has(index) && (
                      <Check className="h-3 w-3" />
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 flex-shrink-0 rounded overflow-hidden bg-muted/30">
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      {product.name && <p className="font-medium truncate">{product.name}</p>}
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {product.description}
                        </p>
                      )}
                      {!product.inStock && (
                        <p className="text-xs text-destructive">Out of stock</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  {product.price !== undefined && (
                    <p className="font-semibold">
                      {formatCurrency(product.price)}
                    </p>
                  )}
                  {product.originalPrice && (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatCurrency(product.originalPrice)}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add to cart button */}
      <div className="flex items-center justify-between gap-4 p-3 border-t-1">
        <div className="text-xs sm:text-sm text-muted-foreground">
          {selectedIndexes.size > 0 ? (
            <span>
              {selectedIndexes.size} item{selectedIndexes.size !== 1 ? 's' : ''}{' '}
              selected
              {' · '}
              <span className="font-medium text-foreground">
                {formatCurrency(totalPrice)}
              </span>
            </span>
          ) : (
            <span>Select products to add to cart</span>
          )}
        </div>
        <Button
          onClick={handleAddToCart}
          disabled={selectedIndexes.size === 0}
          size="sm"
        >
          <ShoppingCart className="h-4 w-4 mr-1.5" />
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}

/**
 * A versatile product list component with list, grid, carousel, and picker variants.
 * Supports product selection, badges, ratings, and add to cart functionality.
 *
 * Features:
 * - Multiple layout variants (list, grid, carousel, picker)
 * - Product cards with images, badges, and pricing
 * - Original price strikethrough for discounts
 * - Star ratings display
 * - Out of stock indication
 * - Single product selection (list/grid/carousel)
 * - Multi-select with cart total (picker)
 * - Responsive layouts for all screen sizes
 * - Animated carousel navigation
 *
 * @component
 * @example
 * ```tsx
 * <ProductList
 *   data={{
 *     products: [
 *       { id: "1", name: "Sneakers", price: 99, image: "/shoe.jpg", rating: 4.5 },
 *       { id: "2", name: "Boots", price: 149, originalPrice: 199, badge: "-25%" }
 *     ]
 *   }}
 *   actions={{
 *     onSelectProduct: (product) => console.log("Selected:", product),
 *     onAddToCart: (products) => console.log("Cart:", products)
 *   }}
 *   appearance={{
 *     variant: "grid",
 *     currency: "USD",
 *     columns: 4
 *   }}
 * />
 * ```
 */
export function ProductList({ data, actions, appearance, control }: ProductListProps) {
  const resolved: NonNullable<ProductListProps['data']> = data ?? { products: demoProducts }
  const products = resolved.products ?? []
  const onSelectProduct = actions?.onSelectProduct
  const onAddToCart = actions?.onAddToCart
  const variant = appearance?.variant ?? 'list'
  const currency = appearance?.currency ?? 'EUR'
  const columns = appearance?.columns ?? 4
  const buttonLabel = appearance?.buttonLabel
  const selectedProductIndex = control?.selectedProductIndex
  const [selected, setSelected] = useState<number | undefined>(selectedProductIndex)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(value)
  }

  const handleSelect = (product: Product, index: number) => {
    setSelected(index)
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

  if (variant === 'picker') {
    return (
      <PickerVariant
        products={products}
        formatCurrency={formatCurrency}
        onAddToCart={onAddToCart}
        buttonLabel={buttonLabel}
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
