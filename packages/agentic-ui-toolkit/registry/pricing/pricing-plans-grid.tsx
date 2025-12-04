"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PlanFeature {
  name: string
}

export interface Plan {
  id: string
  name: string
  description: string
  price: number | "custom"
  features: PlanFeature[]
  badge?: string
  popular?: boolean
  cta?: string
}

export interface PricingPlansGridProps {
  plans?: Plan[]
  defaultBillingCycle?: "monthly" | "yearly"
  yearlyDiscount?: number
  onSelectPlan?: (planId: string, billingCycle: "monthly" | "yearly") => void
  selectedPlanId?: string
}

const defaultPlans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "For developers testing out Liveblocks locally.",
    price: 0,
    cta: "Get started",
    features: [
      { name: "Up to 3 projects" },
      { name: "Basic analytics" },
      { name: "Community support" },
      { name: "1GB storage" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For companies adding collaboration in production.",
    price: 20,
    badge: "Most popular",
    popular: true,
    cta: "Start free trial",
    features: [
      { name: "Unlimited projects" },
      { name: "Advanced analytics" },
      { name: "Priority support" },
      { name: "10GB storage" },
      { name: "Custom domains" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For organizations that need more support.",
    price: "custom",
    cta: "Contact sales",
    features: [
      { name: "Everything in Pro" },
      { name: "Dedicated support" },
      { name: "SLA guarantee" },
      { name: "Unlimited storage" },
      { name: "SSO & SAML" },
      { name: "Custom contracts" },
    ],
  },
]

export function PricingPlansGrid({
  plans = defaultPlans,
  defaultBillingCycle = "monthly",
  yearlyDiscount = 20,
  onSelectPlan,
  selectedPlanId,
}: PricingPlansGridProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    defaultBillingCycle
  )
  const [selected, setSelected] = useState<string | undefined>(selectedPlanId)

  const handleSelectPlan = (planId: string) => {
    setSelected(planId)
    onSelectPlan?.(planId, billingCycle)
  }

  const getPrice = (price: number | "custom") => {
    if (price === "custom") return "Custom"
    if (price === 0) return "$0"
    const finalPrice =
      billingCycle === "yearly"
        ? Math.round(price * (1 - yearlyDiscount / 100))
        : price
    return `$${finalPrice}`
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-center">
        <div className="flex items-center rounded-lg border bg-muted p-1">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              billingCycle === "monthly"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              billingCycle === "yearly"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Yearly
            {yearlyDiscount > 0 && (
              <span className="ml-1.5 text-xs text-green-600">-{yearlyDiscount}%</span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-xl border bg-card p-6 transition-all",
              plan.popular && "border-primary shadow-md",
              selected === plan.id && "ring-2 ring-primary"
            )}
          >
            {plan.badge && (
              <Badge
                className="absolute -top-2.5 left-1/2 -translate-x-1/2"
                variant={plan.popular ? "default" : "secondary"}
              >
                {plan.badge}
              </Badge>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {plan.description}
              </p>
            </div>

            <div className="mb-6">
              <span className="text-3xl font-bold">{getPrice(plan.price)}</span>
              {plan.price !== "custom" && (
                <span className="text-sm text-muted-foreground">/month</span>
              )}
            </div>

            <div className="mb-6 flex-1 space-y-3">
              {plan.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span>{feature.name}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => handleSelectPlan(plan.id)}
              variant={plan.popular ? "default" : "outline"}
              className="w-full"
            >
              {plan.cta || "Select plan"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
