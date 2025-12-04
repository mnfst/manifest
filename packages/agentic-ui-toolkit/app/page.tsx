import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { InlineAmountInput } from '@/registry/inline/inline-amount-input'
import { InlineBarChart } from '@/registry/inline/inline-bar-chart'
import { InlineCardForm } from '@/registry/inline/inline-card-form'
import { InlineOptionList } from '@/registry/inline/inline-option-list'
import { InlineOrderConfirm } from '@/registry/inline/inline-order-confirm'
import { InlinePaymentMethods } from '@/registry/inline/inline-payment-methods'
import { InlinePaymentSuccessCompact } from '@/registry/inline/inline-payment-success-compact'
import { InlinePaymentConfirmed } from '@/registry/inline/inline-payment-confirmed'
import { InlinePieChart } from '@/registry/inline/inline-pie-chart'
import { InlineProductCarousel } from '@/registry/inline/inline-product-carousel'
import { InlineProductGrid } from '@/registry/inline/inline-product-grid'
import {
  InlineProductHorizontal,
  InlineProductHorizontalGrid,
  InlineProductHorizontalCarousel,
} from '@/registry/inline/inline-product-horizontal'
import { InlineProgressSteps } from '@/registry/inline/inline-progress-steps'
import { InlineQuickReply } from '@/registry/inline/inline-quick-reply'
import {
  SkeletonWeather,
  SkeletonProductGrid,
  SkeletonProductCarousel,
  SkeletonPricingPlans,
  SkeletonInlineForm,
  SkeletonOptionList,
  SkeletonTagSelect,
  SkeletonQuickReply,
  SkeletonProgressSteps,
  SkeletonStatusBadge,
  SkeletonStats,
  SkeletonPaymentMethods,
  SkeletonOrderConfirm,
  SkeletonAmountInput,
  SkeletonPaymentSuccess,
  SkeletonPaymentSuccessCompact,
} from '@/registry/inline/inline-skeleton'
import { InlineStats } from '@/registry/inline/inline-stat-card'
import { InlineStatusBadge } from '@/registry/inline/inline-status-badge'
import { InlineTagSelect } from '@/registry/inline/inline-tag-select'
import { WeatherWidget } from '@/registry/misc/weather-widget/weather-widget'
// This page displays items from the custom registry.
// You are free to implement this with your own design as needed.

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col min-h-svh px-4 py-8 gap-8">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Manifest Registry
          </h1>
          <p className="text-muted-foreground">
            A custom registry for distributing code using shadcn.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section className="w-full space-y-8">
        <h2 className="text-xl font-semibold">Weather</h2>
        <WeatherWidget />
      </section>

      <Separator />

      <section className="w-full space-y-8">
        <h2 className="text-xl font-semibold">Payment</h2>
        <p className="text-sm text-muted-foreground">
          Components for direct use in chat flow (vs Card components for
          modals/panels)
        </p>
        <InlineOrderConfirm />
        <Separator />
        <InlinePaymentMethods />
        <Separator />
        <InlineCardForm />
        <Separator />
        <InlineAmountInput />
        <Separator />
        <InlinePaymentSuccessCompact />
        <Separator />
        <InlinePaymentConfirmed />
      </section>

      <Separator />

      <section className="w-full space-y-8">
        <h2 className="text-xl font-semibold">Product Lists</h2>
        <h3 className="text-sm font-medium text-muted-foreground">
          Grid (4 columns, stretched)
        </h3>
        <InlineProductGrid columns={4} />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">
          Grid (3 columns, stretched)
        </h3>
        <InlineProductGrid columns={3} />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">
          Carousel (with gradient fade)
        </h3>
        <InlineProductCarousel />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">
          Horizontal (single column)
        </h3>
        <InlineProductHorizontal />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">
          Horizontal Grid (2 columns)
        </h3>
        <InlineProductHorizontalGrid />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">
          Horizontal Carousel (with gradient fade)
        </h3>
        <InlineProductHorizontalCarousel />
      </section>

      <Separator />

      <section className="w-full space-y-8">
        <h2 className="text-xl font-semibold">Selection</h2>
        <InlineOptionList />
        <Separator />
        <InlineTagSelect />
        <Separator />
        <InlineQuickReply />
      </section>

      <Separator />

      <section className="w-full space-y-8">
        <h2 className="text-xl font-semibold">Status & Progress</h2>
        <InlineProgressSteps />
        <Separator />
        <div className="flex flex-wrap gap-2">
          <InlineStatusBadge status="success" />
          <InlineStatusBadge status="pending" />
          <InlineStatusBadge status="processing" />
          <InlineStatusBadge status="shipped" />
          <InlineStatusBadge status="delivered" />
          <InlineStatusBadge status="error" />
        </div>
      </section>

      <Separator />

      <section className="w-full space-y-8">
        <h2 className="text-xl font-semibold">Charts & Stats</h2>
        <InlineStats />
        <Separator />
        <InlineBarChart title="Monthly Sales" />
        <Separator />
        <InlinePieChart title="Categories" />
      </section>

      <Separator />

      <section className="w-full space-y-8">
        <h2 className="text-xl font-semibold">Loading Skeletons</h2>
        <p className="text-sm text-muted-foreground">
          Placeholder components with pulse animation for loading states
        </p>
        <h3 className="text-sm font-medium text-muted-foreground">Weather</h3>
        <SkeletonWeather />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">Pricing</h3>
        <SkeletonPricingPlans />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">Payment</h3>
        <SkeletonOrderConfirm />
        <Separator />
        <SkeletonPaymentMethods />
        <Separator />
        <SkeletonInlineForm />
        <Separator />
        <SkeletonAmountInput />
        <Separator />
        <SkeletonPaymentSuccess />
        <Separator />
        <SkeletonPaymentSuccessCompact />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">Products</h3>
        <SkeletonProductGrid columns={4} />
        <Separator />
        <SkeletonProductCarousel />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">Selection</h3>
        <SkeletonOptionList />
        <Separator />
        <SkeletonTagSelect />
        <Separator />
        <SkeletonQuickReply />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">Status & Progress</h3>
        <SkeletonProgressSteps />
        <Separator />
        <div className="flex flex-wrap gap-2">
          <SkeletonStatusBadge />
          <SkeletonStatusBadge />
          <SkeletonStatusBadge />
        </div>
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">Charts & Stats</h3>
        <SkeletonStats />
      </section>
    </div>
  )
}
