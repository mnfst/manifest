"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRight, Star } from "lucide-react"
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

export interface InlineProductListProps {
  products?: Product[]
  currency?: string
  onSelectProduct?: (product: Product) => void
  selectedProductId?: string
  maxVisible?: number
}

const defaultProducts: Product[] = [
  {
    id: "1",
    name: "AirPods Pro (2nd gen.)",
    description: "Active noise cancellation",
    price: 279,
    image: "https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQD83?wid=200&hei=200&fmt=jpeg&qlt=95",
    rating: 4.8,
    badge: "Popular",
    inStock: true,
  },
  {
    id: "2",
    name: "AirPods (3rd gen.)",
    description: "Spatial audio",
    price: 199,
    image: "https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MME73?wid=200&hei=200&fmt=jpeg&qlt=95",
    rating: 4.6,
    inStock: true,
  },
  {
    id: "3",
    name: "AirPods Max",
    description: "High-fidelity audio",
    price: 579,
    originalPrice: 629,
    image: "https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/airpods-max-select-silver-202011?wid=200&hei=200&fmt=jpeg&qlt=95",
    rating: 4.7,
    badge: "-8%",
    inStock: true,
  },
  {
    id: "4",
    name: "Beats Studio Pro",
    description: "Personalized spatial audio",
    price: 399,
    image: "https://store.storeimages.cdn-apple.com/4668/as-images.apple.com/is/MQTP3?wid=200&hei=200&fmt=jpeg&qlt=95",
    rating: 4.5,
    inStock: false,
  },
]

export function InlineProductList({
  products = defaultProducts,
  currency = "EUR",
  onSelectProduct,
  selectedProductId,
  maxVisible = 4,
}: InlineProductListProps) {
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

  return (
    <div className="w-full">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {products.slice(0, maxVisible).map((product) => (
          <button
            key={product.id}
            onClick={() => handleSelect(product)}
            disabled={!product.inStock}
            className={cn(
              "flex-shrink-0 w-40 rounded-md sm:rounded-lg border bg-card p-3 text-left transition-all",
              selected === product.id
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-primary/50",
              !product.inStock && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="relative">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-24 w-full rounded-md object-contain bg-white"
                />
              ) : (
                <div className="h-24 w-full rounded-md bg-muted" />
              )}
              {product.badge && (
                <Badge
                  className="absolute -top-1 -right-1 text-[10px]"
                  variant={product.badge.startsWith("-") ? "destructive" : "default"}
                >
                  {product.badge}
                </Badge>
              )}
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-sm font-medium line-clamp-1">{product.name}</p>
              {product.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {product.description}
                </p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-semibold">
                    {formatCurrency(product.price)}
                  </span>
                  {product.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatCurrency(product.originalPrice)}
                    </span>
                  )}
                </div>
                {product.rating && (
                  <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {product.rating}
                  </div>
                )}
              </div>
              {!product.inStock && (
                <p className="text-xs text-destructive">Out of stock</p>
              )}
            </div>
          </button>
        ))}
        {products.length > maxVisible && (
          <button className="flex-shrink-0 w-20 rounded-md sm:rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted transition-colors">
            <ChevronRight className="h-5 w-5" />
            <span className="text-xs">+{products.length - maxVisible}</span>
          </button>
        )}
      </div>
    </div>
  )
}
