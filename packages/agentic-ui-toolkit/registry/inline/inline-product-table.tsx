'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, ShoppingCart } from 'lucide-react'
import { useCallback, useState } from 'react'

export interface Product {
  id: string
  name: string
  description?: string
  price: number
  originalPrice?: number
  image?: string
  inStock?: boolean
}

export interface InlineProductTableProps {
  products?: Product[]
  currency?: string
  onAddToCart?: (products: Product[]) => void
  buttonLabel?: string
}

const defaultProducts: Product[] = [
  {
    id: '1',
    name: "Air Force 1 '07",
    description: 'Nike',
    price: 119,
    image: '/demo/shoe-1.png',
    inStock: true
  },
  {
    id: '2',
    name: 'Air Max 90',
    description: 'Nike',
    price: 140,
    image: '/demo/shoe-2.png',
    inStock: true
  },
  {
    id: '3',
    name: 'Air Max Plus',
    description: 'Nike',
    price: 170,
    originalPrice: 190,
    image: '/demo/shoe-4.png',
    inStock: true
  },
  {
    id: '4',
    name: 'Dunk Low',
    description: 'Nike',
    price: 115,
    image: '/demo/shoe-3.png',
    inStock: true
  },
  {
    id: '5',
    name: 'Air Force 1 Low',
    description: 'Nike',
    price: 110,
    originalPrice: 125,
    image: '/demo/shoe-1.png',
    inStock: false
  }
]

export function InlineProductTable({
  products = defaultProducts,
  currency = 'EUR',
  onAddToCart,
  buttonLabel = 'Add to cart'
}: InlineProductTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(value)
  }

  const handleSelect = useCallback((product: Product) => {
    if (!product.inStock) return

    setSelectedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(product.id)) {
        newSet.delete(product.id)
      } else {
        newSet.add(product.id)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    const availableProducts = products.filter((p) => p.inStock)
    const allSelected = availableProducts.every((p) => selectedIds.has(p.id))

    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(availableProducts.map((p) => p.id)))
    }
  }, [products, selectedIds])

  const handleAddToCart = useCallback(() => {
    const selectedProducts = products.filter((p) => selectedIds.has(p.id))
    onAddToCart?.(selectedProducts)
  }, [products, selectedIds, onAddToCart])

  const availableProducts = products.filter((p) => p.inStock)
  const allSelected =
    availableProducts.length > 0 &&
    availableProducts.every((p) => selectedIds.has(p.id))

  const totalPrice = products
    .filter((p) => selectedIds.has(p.id))
    .reduce((sum, p) => sum + p.price, 0)

  return (
    <div className="w-full space-y-3">
      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-2 px-0.5">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => handleSelect(product)}
            disabled={!product.inStock}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg border bg-card p-2 text-left transition-all',
              selectedIds.has(product.id)
                ? 'border-foreground ring-1 ring-foreground'
                : 'border-border hover:border-foreground/30',
              !product.inStock && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Checkbox */}
            <div
              className={cn(
                'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
                selectedIds.has(product.id)
                  ? 'bg-foreground border-foreground text-background'
                  : 'border-border'
              )}
            >
              {selectedIds.has(product.id) && <Check className="h-3 w-3" />}
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
              <p className="text-sm font-medium truncate">{product.name}</p>
              {product.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {product.description}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold">
                {formatCurrency(product.price)}
              </p>
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
      <div className="hidden sm:block overflow-x-auto rounded-lg mb-0">
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
            {products.map((product) => (
              <tr
                key={product.id}
                onClick={() => handleSelect(product)}
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
                      selectedIds.has(product.id)
                        ? 'bg-foreground border-foreground text-background'
                        : 'border-border'
                    )}
                  >
                    {selectedIds.has(product.id) && (
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
                      <p className="font-medium truncate">{product.name}</p>
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
                  <p className="font-semibold">
                    {formatCurrency(product.price)}
                  </p>
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
        <div className="text-sm text-muted-foreground">
          {selectedIds.size > 0 ? (
            <span>
              {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}{' '}
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
          disabled={selectedIds.size === 0}
          size="sm"
        >
          <ShoppingCart className="h-4 w-4 mr-1.5" />
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}
