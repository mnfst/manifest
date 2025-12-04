"use client"

import { useState, useRef } from "react"
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

export function InlineProductCarousel({
  products = defaultProducts,
  currency = "EUR",
  onSelectProduct,
  selectedProductId,
}: InlineProductCarouselProps) {
  const [selected, setSelected] = useState<string | undefined>(selectedProductId)
  const scrollRef = useRef<HTMLDivElement>(null)

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
    if (scrollRef.current) {
      const scrollAmount = 200
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  return (
    <div className="w-full relative group">
      {/* Left scroll button */}
      <button
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Carousel container with gradient masks */}
      <div className="relative overflow-hidden">
        {/* Left gradient fade */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-[1] pointer-events-none opacity-0" />

        {/* Right gradient fade */}
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-[1] pointer-events-none" />

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => handleSelect(product)}
              disabled={!product.inStock}
              className={cn(
                "flex-shrink-0 w-40 rounded-lg border text-left transition-all overflow-hidden",
                selected === product.id
                  ? "bg-foreground text-background border-foreground"
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
                  <p className={cn(
                    "text-xs line-clamp-1",
                    selected === product.id ? "text-background/70" : "text-muted-foreground"
                  )}>
                    {product.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-semibold">
                      {formatCurrency(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className={cn(
                        "text-xs line-through",
                        selected === product.id ? "text-background/70" : "text-muted-foreground"
                      )}>
                        {formatCurrency(product.originalPrice)}
                      </span>
                    )}
                  </div>
                  {product.rating && (
                    <div className={cn(
                      "flex items-center gap-0.5 text-xs",
                      selected === product.id ? "text-background/70" : "text-muted-foreground"
                    )}>
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

      {/* Right scroll button */}
      <button
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
