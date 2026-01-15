'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTokens, type DesignTokens } from '@/lib/token-context'
import { RotateCcw } from 'lucide-react'

function ColorInput({
  label,
  value,
  onChange,
  description
}: {
  label: string
  value: string
  onChange: (value: string) => void
  description?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={label}>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            id={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-10 rounded-lg border border-input cursor-pointer bg-transparent p-1"
          />
        </div>
        <Input
          type="text"
          value={value.toUpperCase()}
          onChange={(e) => {
            const val = e.target.value
            if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
              onChange(val)
            }
          }}
          className="w-28 font-mono text-sm"
          placeholder="#000000"
        />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = 'px',
  description
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  description?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={label}>{label}</Label>
        <span className="text-sm font-mono text-muted-foreground">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        id={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
      />
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

function PreviewCard() {
  return (
    <div className="border rounded-lg p-6 bg-card space-y-4">
      <div className="space-y-1">
        <h3 className="font-semibold">Preview Card</h3>
        <p className="text-sm text-muted-foreground">
          See how your design tokens affect components in real-time.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button>Primary Button</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="destructive">Destructive</Button>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Sample input field..." className="flex-1" />
        <Button>Submit</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
          Primary Badge
        </span>
        <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          Secondary Badge
        </span>
        <span className="inline-flex items-center rounded-full bg-destructive px-3 py-1 text-xs font-medium text-white">
          Destructive
        </span>
        <span className="inline-flex items-center rounded-full bg-success px-3 py-1 text-xs font-medium text-white">
          Success
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-lg border bg-background">
          <p className="text-xs text-muted-foreground">Background</p>
        </div>
        <div className="p-3 rounded-lg bg-muted">
          <p className="text-xs text-muted-foreground">Muted</p>
        </div>
      </div>
    </div>
  )
}

export default function CustomizePage() {
  const { tokens, updateToken, resetToDefaults, isModified } = useTokens()

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4 sm:px-6">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Customize</h1>
        <p className="text-muted-foreground">
          Customize the design tokens to match your brand. Changes are saved to
          your browser and applied across all components.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Token Controls */}
        <div className="space-y-8">
          {/* Colors Section */}
          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Colors</h2>
              <p className="text-sm text-muted-foreground">
                Customize the color palette for your components.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <ColorInput
                label="Primary Color"
                value={tokens.primaryColor}
                onChange={(value) => updateToken('primaryColor', value)}
                description="Used for primary buttons and key actions"
              />

              <ColorInput
                label="Secondary Color"
                value={tokens.secondaryColor}
                onChange={(value) => updateToken('secondaryColor', value)}
                description="Used for secondary elements and backgrounds"
              />

              <ColorInput
                label="Accent Color"
                value={tokens.accentColor}
                onChange={(value) => updateToken('accentColor', value)}
                description="Used for highlights and hover states"
              />

              <ColorInput
                label="Destructive Color"
                value={tokens.destructiveColor}
                onChange={(value) => updateToken('destructiveColor', value)}
                description="Used for error states and destructive actions"
              />

              <ColorInput
                label="Success Color"
                value={tokens.successColor}
                onChange={(value) => updateToken('successColor', value)}
                description="Used for success states and confirmations"
              />
            </div>
          </section>

          {/* Typography Section */}
          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Typography</h2>
              <p className="text-sm text-muted-foreground">
                Choose the font family for your components.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="font-family">Font Family</Label>
              <Select
                value={tokens.fontFamily}
                onValueChange={(value) =>
                  updateToken('fontFamily', value as DesignTokens['fontFamily'])
                }
              >
                <SelectTrigger id="font-family" className="w-full">
                  <SelectValue placeholder="Select a font" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">
                    System UI (Default)
                  </SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="roboto">Roboto</SelectItem>
                  <SelectItem value="poppins">Poppins</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                System UI uses the native font of each platform for best
                performance.
              </p>
            </div>
          </section>

          {/* Layout Section */}
          <section className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Layout</h2>
              <p className="text-sm text-muted-foreground">
                Adjust border radius values.
              </p>
            </div>

            <div className="space-y-6">
              <SliderInput
                label="Border Radius"
                value={tokens.borderRadius}
                onChange={(value) => updateToken('borderRadius', value)}
                min={0}
                max={24}
                description="Controls the roundness of corners on buttons, cards, and inputs"
              />
            </div>
          </section>

          {/* Reset Button */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              disabled={!isModified}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restore to Default
            </Button>
            {isModified && (
              <p className="text-xs text-muted-foreground mt-2">
                You have unsaved customizations. Click above to restore defaults.
              </p>
            )}
          </div>
        </div>

        {/* Preview Section */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Live Preview</h2>
            <p className="text-sm text-muted-foreground">
              Preview how your tokens affect components.
            </p>
          </div>
          <PreviewCard />

          {/* Current Values */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h3 className="font-medium mb-3 text-sm">Current Token Values</h3>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">--primary:</span>
                <span>{tokens.primaryColor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">--secondary:</span>
                <span>{tokens.secondaryColor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">--accent:</span>
                <span>{tokens.accentColor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">--destructive:</span>
                <span>{tokens.destructiveColor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">--success:</span>
                <span>{tokens.successColor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">--radius:</span>
                <span>{tokens.borderRadius}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">--font-family:</span>
                <span>{tokens.fontFamily}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
