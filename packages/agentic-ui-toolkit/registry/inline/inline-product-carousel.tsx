"use client"

import { useState } from "react"
import { Star, ChevronLeft, ChevronRight } from "lucide-react"
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

export interface InlineProductCarouselProps {
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
  {
    id: "5",
    name: "Air Force 1 Low",
    description: "Nike",
    price: 110,
    originalPrice: 125,
    image: "/demo/shoe-1.png",
    rating: 4.8,
    badge: "-12%",
    inStock: true,
  },
  {
    id: "6",
    name: "Air Max 90 Premium",
    description: "Nike",
    price: 160,
    image: "/demo/shoe-2.png",
    rating: 4.5,
    inStock: true,
  },
]

const CARD_WIDTH = 160 // w-40 = 10rem = 160px
const GAP = 12 // gap-3 = 0.75rem = 12px

export function InlineProductCarousel({
  products = defaultProducts,
  currency = "EUR",
  onSelectProduct,
  selectedProductId,
}: InlineProductCarouselProps) {
  const [selected, setSelected] = useState<string | undefined>(selectedProductId)
  const [currentIndex, setCurrentIndex] = useState(0)
  const maxIndex = Math.max(0, products.length - 3)

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
    <div className="w-full relative">
      {/* Left scroll button */}
      <button
        onClick={() => scroll("left")}
        disabled={currentIndex === 0}
        className={cn(
          "absolute left-2 top-16 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center transition-opacity",
          currentIndex === 0 ? "opacity-0 cursor-not-allowed" : "hover:bg-background"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Right scroll button */}
      <button
        onClick={() => scroll("right")}
        disabled={currentIndex >= maxIndex}
        className={cn(
          "absolute right-2 top-16 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center transition-opacity",
          currentIndex >= maxIndex ? "opacity-0 cursor-not-allowed" : "hover:bg-background"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="overflow-hidden">
        <div
          className="flex gap-3 transition-transform duration-300 ease-out pb-2"
          style={{
            transform: `translateX(-${currentIndex * (CARD_WIDTH + GAP)}px)`,
          }}
        >
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => handleSelect(product)}
              disabled={!product.inStock}
              className={cn(
                "flex-shrink-0 w-40 rounded-[12px] border text-left transition-all overflow-hidden",
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
                    className="h-32 w-full object-cover bg-muted/30"
                  />
                ) : (
                  <div className="h-32 w-full bg-muted" />
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
              <div className="p-3 space-y-1">
                <p className="text-sm font-medium line-clamp-1">{product.name}</p>
                {product.description && (
                  <p className="text-xs line-clamp-1 text-muted-foreground">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-semibold">
                      {formatCurrency(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-xs line-through text-muted-foreground">
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
        </div>
      </div>
    </div>
  )
}
