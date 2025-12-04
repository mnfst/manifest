import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { InlineAmountInput } from '@/registry/inline/inline-amount-input'
import { InlineBarChart } from '@/registry/inline/inline-bar-chart'
import { InlineCardForm } from '@/registry/inline/inline-card-form'
import { InlineOptionList } from '@/registry/inline/inline-option-list'
import { InlineOrderConfirm } from '@/registry/inline/inline-order-confirm'
import { InlinePaymentMethods } from '@/registry/inline/inline-payment-methods'
import { InlinePaymentSuccess } from '@/registry/inline/inline-payment-success'
import { InlinePieChart } from '@/registry/inline/inline-pie-chart'
import { InlineProductCarousel } from '@/registry/inline/inline-product-carousel'
import { InlineProductGrid } from '@/registry/inline/inline-product-grid'
import { InlineProgressSteps } from '@/registry/inline/inline-progress-steps'
import { InlineQuickReply } from '@/registry/inline/inline-quick-reply'
import { InlineStats } from '@/registry/inline/inline-stat-card'
import { InlineStatusBadge } from '@/registry/inline/inline-status-badge'
import { InlineTagSelect } from '@/registry/inline/inline-tag-select'
import { WeatherWidget } from '@/registry/misc/weather-widget/weather-widget'
import { CardForm } from '@/registry/payment/card-form'
import { OrderSummary } from '@/registry/payment/order-summary'
import { PayConfirm } from '@/registry/payment/pay-confirm'
import { PaymentSuccess } from '@/registry/payment/payment-success'
import { SavedCards } from '@/registry/payment/saved-cards'
import { PricingPlans } from '@/registry/pricing/pricing-plans'
import { PricingPlansGrid } from '@/registry/pricing/pricing-plans-grid'
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
        <h2 className="text-xl font-semibold">Payment Components</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <CardForm />
          <SavedCards />
        </div>
        <Separator />
        <div className="grid gap-6 md:grid-cols-2">
          <PayConfirm amount={279.0} currency="EUR" />
          <PaymentSuccess />
        </div>
        <Separator />
        <OrderSummary />
      </section>

      <Separator />

      <section className="w-full space-y-8">
        <h2 className="text-xl font-semibold">Pricing</h2>
        <h3 className="text-sm font-medium text-muted-foreground">
          List (full width)
        </h3>
        <PricingPlans />
        <Separator />
        <h3 className="text-sm font-medium text-muted-foreground">
          Grid (3 columns)
        </h3>
        <PricingPlansGrid />
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
        <InlinePaymentSuccess />
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
    </div>
  )
}
