'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTokens, type DesignTokens } from '@/lib/token-context'
import { ArrowRight, ChevronDown, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'

// Registry components
import { ContactForm } from '@/registry/form/contact-form'
import { CardForm } from '@/registry/payment/card-form'
import { PayConfirm } from '@/registry/payment/pay-confirm'
import { OrderSummary } from '@/registry/payment/order-summary'
import { AmountInput } from '@/registry/payment/amount-input'
import { OptionList } from '@/registry/selection/option-list'
import { TagSelect } from '@/registry/selection/tag-select'
import { QuickReply } from '@/registry/selection/quick-reply'
import { ProgressSteps } from '@/registry/status/progress-steps'
import { StatusBadge } from '@/registry/status/status-badge'
import { Stats } from '@/registry/miscellaneous/stat-card'
import { PostCard } from '@/registry/blogging/post-card'
import { MessageBubble } from '@/registry/messaging/message-bubble'
import { Table } from '@/registry/list/table'

// ---------------------------------------------------------------------------
// Sidebar control components
// ---------------------------------------------------------------------------

function ColorRow({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="shrink-0 w-6 h-6 rounded-full border-2 border-border/60 hover:border-foreground/30 transition-colors cursor-pointer shadow-sm"
            style={{ backgroundColor: value }}
          />
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={12}
          className="w-auto p-3 rounded-xl"
        >
          <HexColorPicker color={value} onChange={onChange} />
          <div className="mt-3">
            <Input
              type="text"
              value={value.toUpperCase()}
              onChange={(e) => {
                const val = e.target.value
                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                  onChange(val)
                }
              }}
              className="h-8 text-xs font-mono text-center rounded-lg"
              placeholder="#000000"
            />
          </div>
        </PopoverContent>
      </Popover>
      <span className="text-[11px] text-muted-foreground w-[52px] shrink-0 truncate">{label}</span>
      <Input
        type="text"
        value={value.toUpperCase()}
        onChange={(e) => {
          const val = e.target.value
          if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
            onChange(val)
          }
        }}
        className="h-6 text-[11px] font-mono px-1.5 rounded-md flex-1 min-w-0"
        placeholder="#000000"
      />
    </div>
  )
}

function ColorPairInput({
  label,
  bgValue,
  fgValue,
  onBgChange,
  onFgChange
}: {
  label: string
  bgValue: string
  fgValue: string
  onBgChange: (value: string) => void
  onFgChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      <ColorRow label="Color" value={bgValue} onChange={onBgChange} />
      <ColorRow label="Text" value={fgValue} onChange={onFgChange} />
    </div>
  )
}

function Section({
  title,
  defaultOpen = true,
  children
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border pb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-1 text-sm font-medium hover:text-foreground/80 transition-colors"
      >
        {title}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview grid items
// ---------------------------------------------------------------------------

const showcaseItems: { label: string; component: React.ReactNode }[] = [
  {
    label: 'Contact Form',
    component: <ContactForm />
  },
  {
    label: 'Card Form',
    component: <CardForm />
  },
  {
    label: 'Stats',
    component: (
      <Stats
        data={{
          stats: [
            { label: 'Revenue', value: '$12,345', change: 12.5 },
            { label: 'Orders', value: '1,234', change: -3.2 },
            { label: 'Customers', value: '567', change: 8.1 }
          ]
        }}
      />
    )
  },
  {
    label: 'Post Card',
    component: (
      <PostCard
        data={{
          post: {
            title: 'Getting Started with Agentic UI',
            excerpt:
              'Learn how to build conversational interfaces with our component library.',
            coverImage:
              'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
            author: {
              name: 'Sarah Chen',
              avatar: 'https://i.pravatar.cc/150?u=sarah'
            },
            publishedAt: '2024-01-15',
            readTime: '5 min read',
            tags: ['Tutorial', 'Components'],
            category: 'Tutorial'
          }
        }}
      />
    )
  },
  {
    label: 'Order Summary',
    component: (
      <OrderSummary
        data={{
          items: [
            { id: '1', name: 'Wireless Headphones', quantity: 1, price: 199.99 },
            { id: '2', name: 'Phone Case', quantity: 2, price: 29.99 }
          ],
          subtotal: 259.97,
          shipping: 9.99,
          tax: 21.6,
          total: 291.56
        }}
      />
    )
  },
  {
    label: 'Pay Confirm',
    component: (
      <PayConfirm
        data={{ amount: 259.97, cardLast4: '4242', cardBrand: 'visa' }}
      />
    )
  },
  {
    label: 'Table',
    component: (
      <Table
        data={{
          columns: [
            { header: 'Name', accessor: 'name' },
            { header: 'Email', accessor: 'email' },
            { header: 'Status', accessor: 'status' }
          ],
          rows: [
            { name: 'John Doe', email: 'john@example.com', status: 'Active' },
            { name: 'Jane Smith', email: 'jane@example.com', status: 'Pending' },
            { name: 'Bob Johnson', email: 'bob@example.com', status: 'Active' }
          ]
        }}
      />
    )
  },
  {
    label: 'Option List',
    component: (
      <OptionList
        data={{
          options: [
            { label: 'Option A' },
            { label: 'Option B' },
            { label: 'Option C' }
          ]
        }}
      />
    )
  },
  {
    label: 'Tag Select',
    component: (
      <TagSelect
        data={{
          tags: [
            { id: '1', label: 'Important', color: 'red' },
            { id: '2', label: 'In Progress', color: 'yellow' },
            { id: '3', label: 'Done', color: 'green' }
          ]
        }}
      />
    )
  },
  {
    label: 'Quick Reply',
    component: (
      <QuickReply
        data={{
          replies: [
            { label: 'Yes, please' },
            { label: 'No, thanks' },
            { label: 'Tell me more' }
          ]
        }}
      />
    )
  },
  {
    label: 'Progress Steps',
    component: (
      <ProgressSteps
        data={{
          steps: [
            { id: '1', label: 'Cart', status: 'completed' },
            { id: '2', label: 'Shipping', status: 'current' },
            { id: '3', label: 'Payment', status: 'pending' },
            { id: '4', label: 'Confirm', status: 'pending' }
          ]
        }}
      />
    )
  },
  {
    label: 'Message Bubble',
    component: (
      <div className="space-y-3 w-full">
        <MessageBubble
          data={{
            content: 'Hey! How are you doing?',
            avatarFallback: 'J',
            time: '10:30 AM'
          }}
        />
        <MessageBubble
          data={{
            content: "I'm doing great, thanks for asking!",
            time: '10:31 AM'
          }}
          appearance={{ isOwn: true }}
          control={{ status: 'read' }}
        />
      </div>
    )
  },
  {
    label: 'Amount Input',
    component: <AmountInput data={{ presets: [10, 25, 50, 100] }} />
  },
  {
    label: 'Status Badge',
    component: (
      <div className="flex flex-wrap gap-2">
        <StatusBadge data={{ status: 'processing' }} appearance={{ label: 'Processing' }} />
        <StatusBadge data={{ status: 'success' }} appearance={{ label: 'Success' }} />
        <StatusBadge data={{ status: 'error' }} appearance={{ label: 'Error' }} />
      </div>
    )
  }
]

// ---------------------------------------------------------------------------
// Hook: apply token CSS variables to a scoped container (not :root)
// ---------------------------------------------------------------------------

function hexToOklch(hex: string): string {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb
  const z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z)
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z)
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.633851707 * z)
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  const C = Math.sqrt(a * a + bVal * bVal)
  let H = (Math.atan2(bVal, a) * 180) / Math.PI
  if (H < 0) H += 360
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(3)})`
}

function useScopedTokens(tokens: DesignTokens) {
  const ref = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const targets = [ref.current, mobileRef.current].filter(Boolean) as HTMLDivElement[]
    if (targets.length === 0) return

    const vars: Record<string, string> = {
      '--primary': hexToOklch(tokens.primaryColor),
      '--primary-foreground': hexToOklch(tokens.primaryForeground),
      '--secondary': hexToOklch(tokens.secondaryColor),
      '--secondary-foreground': hexToOklch(tokens.secondaryForeground),
      '--accent': hexToOklch(tokens.accentColor),
      '--accent-foreground': hexToOklch(tokens.accentForeground),
      '--destructive': hexToOklch(tokens.destructiveColor),
      '--destructive-foreground': hexToOklch(tokens.destructiveForeground),
      '--success': hexToOklch(tokens.successColor),
      '--success-foreground': hexToOklch(tokens.successForeground),
      '--border': hexToOklch(tokens.borderColor),
      '--input': hexToOklch(tokens.inputBorderColor),
      '--ring': hexToOklch(tokens.ringColor),
      '--radius': `${tokens.borderRadius / 16}rem`,
      '--radius-sm': `${Math.max(tokens.borderRadius - 2, 2) / 16}rem`,
      '--radius-md': `${tokens.borderRadius / 16}rem`,
      '--radius-lg': `${(tokens.borderRadius + 2) / 16}rem`,
      '--radius-xl': `${(tokens.borderRadius + 4) / 16}rem`,
    }

    for (const target of targets) {
      for (const [prop, val] of Object.entries(vars)) {
        target.style.setProperty(prop, val)
      }
    }
  }, [tokens])

  return { ref, mobileRef }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CustomizePage() {
  const { tokens, updateToken, resetToDefaults, isModified } = useTokens()
  const { ref: previewRef, mobileRef } = useScopedTokens(tokens)
  const [showCta, setShowCta] = useState(false)

  // Show the CTA after first modification with a slight delay
  useEffect(() => {
    if (isModified && !showCta) {
      const timer = setTimeout(() => setShowCta(true), 600)
      return () => clearTimeout(timer)
    }
    if (!isModified) {
      setShowCta(false)
    }
  }, [isModified, showCta])

  const sidebarContent = (
    <>
      <Section title="Colors">
        <div className="space-y-4">
          <ColorPairInput label="Primary" bgValue={tokens.primaryColor} fgValue={tokens.primaryForeground} onBgChange={(v) => updateToken('primaryColor', v)} onFgChange={(v) => updateToken('primaryForeground', v)} />
          <ColorPairInput label="Secondary" bgValue={tokens.secondaryColor} fgValue={tokens.secondaryForeground} onBgChange={(v) => updateToken('secondaryColor', v)} onFgChange={(v) => updateToken('secondaryForeground', v)} />
          <ColorPairInput label="Accent" bgValue={tokens.accentColor} fgValue={tokens.accentForeground} onBgChange={(v) => updateToken('accentColor', v)} onFgChange={(v) => updateToken('accentForeground', v)} />
          <ColorPairInput label="Destructive" bgValue={tokens.destructiveColor} fgValue={tokens.destructiveForeground} onBgChange={(v) => updateToken('destructiveColor', v)} onFgChange={(v) => updateToken('destructiveForeground', v)} />
          <ColorPairInput label="Success" bgValue={tokens.successColor} fgValue={tokens.successForeground} onBgChange={(v) => updateToken('successColor', v)} onFgChange={(v) => updateToken('successForeground', v)} />
        </div>
      </Section>

      <Section title="Border & Input">
        <div className="space-y-2">
          <ColorRow label="Border" value={tokens.borderColor} onChange={(v) => updateToken('borderColor', v)} />
          <ColorRow label="Input" value={tokens.inputBorderColor} onChange={(v) => updateToken('inputBorderColor', v)} />
          <ColorRow label="Focus ring" value={tokens.ringColor} onChange={(v) => updateToken('ringColor', v)} />
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-1">
          <Label className="text-xs">Font Family</Label>
          <Select
            value={tokens.fontFamily}
            onValueChange={(v) => updateToken('fontFamily', v as DesignTokens['fontFamily'])}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System UI</SelectItem>
              <SelectItem value="inter">Inter</SelectItem>
              <SelectItem value="roboto">Roboto</SelectItem>
              <SelectItem value="poppins">Poppins</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section title="Layout">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Border Radius</Label>
            <span className="text-xs font-mono text-muted-foreground">{tokens.borderRadius}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={24}
            value={tokens.borderRadius}
            onChange={(e) => updateToken('borderRadius', Number(e.target.value))}
            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </Section>

      <div className="pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={resetToDefaults}
          disabled={!isModified}
          className="w-full gap-1.5 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          Restore Defaults
        </Button>
      </div>

      {/* CTA - animated appearance */}
      <div
        className={`pt-2 transition-all duration-500 ease-out ${
          showCta
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <a
          href="https://manifest.build?ref=toolkit"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Use with Manifest!
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </>
  )

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Mobile controls (shown above grid on small screens) */}
      <div className="lg:hidden w-full">
        <div className="p-4 border-b space-y-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Customize</h1>
            <p className="text-sm text-muted-foreground">
              Adjust tokens and see changes live.
            </p>
          </div>
          {sidebarContent}
        </div>

        {/* Mobile grid */}
        <div ref={mobileRef} className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 [&_input:focus-visible]:!border-[var(--ring)] [&_select:focus-visible]:!border-[var(--ring)] [&_textarea:focus-visible]:!border-[var(--ring)]">
          {showcaseItems.map((item) => (
            <div key={item.label}>
              {item.component}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex w-full">
        {/* Center: component grid — tokens scoped here only */}
        <div ref={previewRef} className="flex-1 p-8 overflow-y-auto [&_input:focus-visible]:!border-[var(--ring)] [&_select:focus-visible]:!border-[var(--ring)] [&_textarea:focus-visible]:!border-[var(--ring)]">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Customize</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Adjust design tokens on the right and see changes reflected across all components in real-time.
            </p>
          </div>
          <div className="columns-2 gap-6 [&>div]:mb-6 [&>div]:break-inside-avoid">
            {showcaseItems.map((item) => (
              <div key={item.label}>
                {item.component}
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar: controls */}
        <aside className="w-[280px] shrink-0 border-l bg-card sticky top-[3.5rem] h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-5 space-y-4">
            {sidebarContent}
          </div>
        </aside>
      </div>
    </div>
  )
}
