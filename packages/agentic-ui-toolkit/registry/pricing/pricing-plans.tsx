"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
}

export interface PricingPlansProps {
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
    features: [
      { name: "Presence" },
      { name: "Comments" },
      { name: "Notifications" },
      { name: "Text Editor" },
      { name: "Sync Datastore" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For companies adding collaboration in production.",
    price: 20,
    badge: "Most popular",
    popular: true,
    features: [
      { name: "Presence" },
      { name: "Comments" },
      { name: "Notifications" },
      { name: "Text Editor" },
      { name: "Sync Datastore" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For organizations that need more support and compliance features.",
    price: "custom",
    features: [
      { name: "Presence" },
      { name: "Comments" },
      { name: "Notifications" },
      { name: "Text Editor" },
      { name: "Sync Datastore" },
    ],
  },
]

export function PricingPlans({
  plans = defaultPlans,
  defaultBillingCycle = "monthly",
  yearlyDiscount = 20,
  onSelectPlan,
  selectedPlanId,
}: PricingPlansProps) {
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
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <CardTitle className="text-xl font-semibold">Upgrade Plan</CardTitle>
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
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => handleSelectPlan(plan.id)}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-all",
              selected === plan.id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-1 h-4 w-4 rounded-full border-2 transition-colors",
                    selected === plan.id
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30"
                  )}
                >
                  {selected === plan.id && (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{plan.name}</span>
                    {plan.badge && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {plan.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold">{getPrice(plan.price)}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 pl-7">
              {plan.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                  {feature.name}
                </div>
              ))}
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
