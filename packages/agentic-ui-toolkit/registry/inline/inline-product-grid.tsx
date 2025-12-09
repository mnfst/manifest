"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

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

export interface InlineProductGridProps {
  products?: Product[]
  currency?: string
  onSelectProduct?: (product: Product) => void
  selectedProductId?: string
  columns?: 3 | 4
}

const defaultProducts: Product[] = [
  {
    id: "1",
    name: "Air Force 1 '07",
    description: "Nike",
    price: 119,
    image: "/demo/shoe-1.png",
    rating: 4.9,
    badge: "New",
    inStock: true,
  },
  {
    id: "2",
    name: "Air Max 90",
    description: "Nike",
    price: 140,
    image: "/demo/shoe-2.png",
    rating: 4.8,
    inStock: true,
  },
  {
    id: "3",
    name: "Air Max Plus",
    description: "Nike",
    price: 170,
    originalPrice: 190,
    image: "/demo/shoe-4.png",
    rating: 4.7,
    badge: "-10%",
    inStock: true,
  },
  {
    id: "4",
    name: "Dunk Low",
    description: "Nike",
    price: 115,
    image: "/demo/shoe-3.png",
    rating: 4.6,
    inStock: true,
  },
]

export function InlineProductGrid({
  products = defaultProducts,
  currency = "EUR",
  onSelectProduct,
  selectedProductId,
  columns = 4,
}: InlineProductGridProps) {
  const [selected, setSelected] = useState<string | undefined>(selectedProductId)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(value)
  }

  const handleSelect = (product: Product) => {
    setSelected(product.id)
    onSelectProduct?.(product)
  }

  const displayProducts = products.slice(0, columns)

  return (
    <div className="w-full p-1 sm:p-0">
      <div
        className={cn(
          "grid gap-2 sm:gap-3 grid-cols-2",
          columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"
        )}
      >
        {displayProducts.map((product) => (
          <button
            key={product.id}
            onClick={() => handleSelect(product)}
            disabled={!product.inStock}
            className={cn(
              "rounded-[12px] border text-left transition-all overflow-hidden",
              selected === product.id
                ? "bg-card border-foreground ring-1 ring-foreground"
                : "bg-card border-border hover:border-foreground/50",
              !product.inStock && "opacity-50 cursor-not-allowed"
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
                    "absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-medium rounded",
                    product.badge.startsWith("-")
                      ? "bg-foreground text-background"
                      : "bg-background text-foreground border border-border"
                  )}
                >
                  {product.badge}
                </span>
              )}
            </div>
            <div className="p-2 sm:p-3 space-y-0.5 sm:space-y-1">
              <p className="text-xs sm:text-sm font-medium line-clamp-1">{product.name}</p>
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
                <p className="text-[10px] sm:text-xs text-destructive">Out of stock</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
