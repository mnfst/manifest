"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
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

export interface InlineProductHorizontalProps {
  products?: Product[]
  currency?: string
  onSelectProduct?: (product: Product) => void
  selectedProductId?: string
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

function ProductHorizontalCard({
  product,
  selected,
  onSelect,
  formatCurrency,
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
        "w-full flex items-center gap-3 rounded-[12px] border p-2 text-left transition-all",
        selected
          ? "bg-card border-foreground ring-1 ring-foreground"
          : "bg-card border-border hover:border-foreground/50",
        !product.inStock && "opacity-50 cursor-not-allowed"
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
              "absolute top-1 left-1 px-1 py-0.5 text-[8px] font-medium rounded",
              product.badge.startsWith("-")
                ? "bg-foreground text-background"
                : "bg-background text-foreground border border-border"
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

export function InlineProductHorizontal({
  products = defaultProducts,
  currency = "EUR",
  onSelectProduct,
  selectedProductId,
}: InlineProductHorizontalProps) {
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
    <div className="w-full space-y-2 p-1 sm:p-0">
      {products.slice(0, 4).map((product) => (
        <ProductHorizontalCard
          key={product.id}
          product={product}
          selected={selected === product.id}
          onSelect={() => handleSelect(product)}
          formatCurrency={formatCurrency}
        />
      ))}
    </div>
  )
}

export function InlineProductHorizontalGrid({
  products = defaultProducts,
  currency = "EUR",
  onSelectProduct,
  selectedProductId,
}: InlineProductHorizontalProps) {
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
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 sm:p-0">
      {products.slice(0, 4).map((product) => (
        <ProductHorizontalCard
          key={product.id}
          product={product}
          selected={selected === product.id}
          onSelect={() => handleSelect(product)}
          formatCurrency={formatCurrency}
        />
      ))}
    </div>
  )
}

export function InlineProductHorizontalCarousel({
  products = defaultProducts,
  currency = "EUR",
  onSelectProduct,
  selectedProductId,
}: InlineProductHorizontalProps) {
  const [selected, setSelected] = useState<string | undefined>(selectedProductId)
  const [currentIndex, setCurrentIndex] = useState(0)
  const displayProducts = products.slice(0, 6)
  const maxIndex = Math.max(0, displayProducts.length - 2)

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

  const scroll = (direction: "left" | "right") => {
    if (direction === "left" && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    } else if (direction === "right" && currentIndex < maxIndex) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  return (
    <div className="w-full relative p-1 sm:p-0">
      <button
        onClick={() => scroll("left")}
        disabled={currentIndex === 0}
        className={cn(
          "absolute left-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center transition-opacity",
          currentIndex === 0 ? "opacity-0 cursor-not-allowed" : "hover:bg-background"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => scroll("right")}
        disabled={currentIndex >= maxIndex}
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center transition-opacity",
          currentIndex >= maxIndex ? "opacity-0 cursor-not-allowed" : "hover:bg-background"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="overflow-hidden">
        <div
          className="flex gap-2 transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(calc(-${currentIndex} * (((100% - 0.5rem) / 2.3) + 0.5rem)))`,
          }}
        >
          {displayProducts.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0"
              style={{ width: "calc((100% - 0.5rem) / 2.3)" }}
            >
              <ProductHorizontalCard
                product={product}
                selected={selected === product.id}
                onSelect={() => handleSelect(product)}
                formatCurrency={formatCurrency}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
