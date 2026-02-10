'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getTokenCssVars, useTokens, type DesignTokens, type ThemeMode } from '@/lib/token-context';
import { ArrowRight, ChevronDown, Moon, Palette, RotateCcw, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';

// Registry components
import { PostCard } from '@/registry/blogging/post-card';
import { ContactForm } from '@/registry/form/contact-form';
import { Table } from '@/registry/list/table';
import { MessageBubble } from '@/registry/messaging/message-bubble';
import { StatCard } from '@/registry/miscellaneous/stat-card';
import { AmountInput } from '@/registry/payment/amount-input';
import { CardForm } from '@/registry/payment/card-form';
import { OrderSummary } from '@/registry/payment/order-summary';
import { PayConfirm } from '@/registry/payment/pay-confirm';
import { OptionList } from '@/registry/selection/option-list';
import { QuickReply } from '@/registry/selection/quick-reply';
import { TagSelect } from '@/registry/selection/tag-select';
import { ProgressSteps } from '@/registry/status/progress-steps';
import { StatusBadge } from '@/registry/status/status-badge';

// ---------------------------------------------------------------------------
// Sidebar control components
// ---------------------------------------------------------------------------

type ColorFormat = 'HEX' | 'RGBA' | 'HSLA';

function hexToRgba(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

function hexToHsla(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }
  return `hsla(${Math.round(hue * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, 1)`;
}

function parseColorToHex(input: string): string | null {
  const trimmed = input.trim();
  // HEX
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  // rgba(r, g, b, a)
  const rgbaMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgbaMatch) {
    const [, r, g, b] = rgbaMatch;
    const toHex = (n: string) => parseInt(n).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  // hsla(h, s%, l%, a)
  const hslaMatch = trimmed.match(/^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?/);
  if (hslaMatch) {
    const [, hStr, sStr, lStr] = hslaMatch;
    const h = parseInt(hStr) / 360;
    const s = parseInt(sStr) / 100;
    const l = parseInt(lStr) / 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return null;
}

function formatColor(hex: string, format: ColorFormat): string {
  if (format === 'RGBA') return hexToRgba(hex);
  if (format === 'HSLA') return hexToHsla(hex);
  return hex.toUpperCase();
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [format, setFormat] = useState<ColorFormat>('HEX');
  const [inputValue, setInputValue] = useState(formatColor(value, format));

  // Sync input when value or format changes externally
  useEffect(() => {
    setInputValue(formatColor(value, format));
  }, [value, format]);

  const handleInputChange = (raw: string) => {
    setInputValue(raw);
    const parsed = parseColorToHex(raw);
    if (parsed) onChange(parsed);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center w-full gap-2.5 px-2 py-1.5 -mx-2 rounded-md hover:bg-foreground/5 transition-colors cursor-pointer"
        >
          <span
            className="shrink-0 w-5 h-5 rounded-full border border-border/60 shadow-sm"
            style={{ backgroundColor: value }}
          />
          <span className="text-[12px] text-muted-foreground flex-1 text-left">{label}</span>
          <span className="text-[11px] font-mono text-muted-foreground/70">
            {value.toUpperCase()}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={8}
        collisionPadding={16}
        className="w-[220px] p-3 rounded-xl z-[60]"
      >
        <HexColorPicker color={value} onChange={onChange} />

        <div className="mt-3 space-y-2">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground">Value</span>
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="h-8 text-xs font-mono text-center rounded-lg mt-1"
            />
          </div>

          <div>
            <span className="text-[11px] font-medium text-muted-foreground">Format</span>
            <Select value={format} onValueChange={(v) => setFormat(v as ColorFormat)}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HEX">HEX</SelectItem>
                <SelectItem value="RGBA">RGBA</SelectItem>
                <SelectItem value="HSLA">HSLA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColorPairInput({
  label,
  bgValue,
  fgValue,
  onBgChange,
  onFgChange,
}: {
  label: string;
  bgValue: string;
  fgValue: string;
  onBgChange: (value: string) => void;
  onFgChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      <ColorRow label="Color" value={bgValue} onChange={onBgChange} />
      <ColorRow label="Text" value={fgValue} onChange={onFgChange} />
    </div>
  );
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className=" border-border pb-4">
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
  );
}

// ---------------------------------------------------------------------------
// Preview grid items
// ---------------------------------------------------------------------------

const showcaseItems: { label: string; component: React.ReactNode }[] = [
  {
    label: 'Contact Form',
    component: <ContactForm />,
  },
  {
    label: 'Card Form',
    component: <CardForm />,
  },
  {
    label: 'Stat Card',
    component: (
      <StatCard
        data={{
          stats: [
            { label: 'Revenue', value: '$12,345', change: 12.5 },
            { label: 'Orders', value: '1,234', change: -3.2 },
            { label: 'Customers', value: '567', change: 8.1 },
          ],
        }}
      />
    ),
  },
  {
    label: 'Post Card',
    component: (
      <PostCard
        data={{
          post: {
            title: 'Getting Started with Agentic UI',
            excerpt: 'Learn how to build conversational interfaces with our component library.',
            coverImage: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
            author: {
              name: 'Sarah Chen',
              avatar: 'https://i.pravatar.cc/150?u=sarah',
            },
            publishedAt: '2024-01-15',
            readTime: '5 min read',
            tags: ['Tutorial', 'Components'],
            category: 'Tutorial',
          },
        }}
      />
    ),
  },
  {
    label: 'Order Summary',
    component: (
      <OrderSummary
        data={{
          items: [
            { id: '1', name: 'Wireless Headphones', quantity: 1, price: 199.99 },
            { id: '2', name: 'Phone Case', quantity: 2, price: 29.99 },
          ],
          subtotal: 259.97,
          shipping: 9.99,
          tax: 21.6,
          total: 291.56,
        }}
      />
    ),
  },
  {
    label: 'Pay Confirm',
    component: <PayConfirm data={{ amount: 259.97, cardLast4: '4242', cardBrand: 'visa' }} />,
  },
  {
    label: 'Table',
    component: (
      <Table
        data={{
          columns: [
            { header: 'Name', accessor: 'name' },
            { header: 'Email', accessor: 'email' },
            { header: 'Status', accessor: 'status' },
          ],
          rows: [
            { name: 'John Doe', email: 'john@example.com', status: 'Active' },
            { name: 'Jane Smith', email: 'jane@example.com', status: 'Pending' },
            { name: 'Bob Johnson', email: 'bob@example.com', status: 'Active' },
          ],
        }}
      />
    ),
  },
  {
    label: 'Option List',
    component: (
      <OptionList
        data={{
          options: [{ label: 'Option A' }, { label: 'Option B' }, { label: 'Option C' }],
        }}
      />
    ),
  },
  {
    label: 'Tag Select',
    component: (
      <TagSelect
        data={{
          tags: [
            { id: '1', label: 'Important', color: 'red' },
            { id: '2', label: 'In Progress', color: 'yellow' },
            { id: '3', label: 'Done', color: 'green' },
          ],
        }}
      />
    ),
  },
  {
    label: 'Quick Reply',
    component: (
      <QuickReply
        data={{
          replies: [{ label: 'Yes, please' }, { label: 'No, thanks' }, { label: 'Tell me more' }],
        }}
      />
    ),
  },
  {
    label: 'Progress Steps',
    component: (
      <ProgressSteps
        data={{
          steps: [
            { label: 'Cart', status: 'completed' },
            { label: 'Shipping', status: 'current' },
            { label: 'Payment', status: 'pending' },
            { label: 'Confirm', status: 'pending' },
          ],
        }}
      />
    ),
  },
  {
    label: 'Message Bubble',
    component: (
      <div className="space-y-3 w-full">
        <MessageBubble
          data={{
            content: 'Hey! How are you doing?',
            avatarFallback: 'J',
            time: '10:30 AM',
          }}
        />
        <MessageBubble
          data={{
            content: "I'm doing great, thanks for asking!",
            time: '10:31 AM',
          }}
          appearance={{ isOwn: true }}
          control={{ status: 'read' }}
        />
      </div>
    ),
  },
  {
    label: 'Amount Input',
    component: <AmountInput data={{ presets: [10, 25, 50, 100] }} />,
  },
  {
    label: 'Status Badge',
    component: (
      <div className="flex flex-wrap gap-2">
        <StatusBadge data={{ status: 'processing' }} appearance={{ label: 'Processing' }} />
        <StatusBadge data={{ status: 'success' }} appearance={{ label: 'Success' }} />
        <StatusBadge data={{ status: 'error' }} appearance={{ label: 'Error' }} />
      </div>
    ),
  },
];

// ---------------------------------------------------------------------------
// Hook: apply token CSS variables to a scoped container (not :root)
// ---------------------------------------------------------------------------

function useScopedTokens(tokens: DesignTokens, mode: ThemeMode) {
  const ref = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = [ref.current, mobileRef.current].filter(Boolean) as HTMLDivElement[];
    if (targets.length === 0) return;

    const vars = getTokenCssVars(tokens, mode);

    for (const target of targets) {
      for (const [prop, val] of Object.entries(vars)) {
        target.style.setProperty(prop, val);
      }
      target.style.backgroundColor = `var(--background)`;
      target.style.color = `var(--foreground)`;
    }
  }, [tokens, mode]);

  return { ref, mobileRef };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CustomizePage() {
  const { tokens, updateToken, resetToDefaults, isModified, mode, setMode } = useTokens();
  const { ref: previewRef, mobileRef } = useScopedTokens(tokens, mode);
  const [showCta, setShowCta] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Show the CTA after first modification with a slight delay
  useEffect(() => {
    if (isModified && !showCta) {
      const timer = setTimeout(() => setShowCta(true), 600);
      return () => clearTimeout(timer);
    }
    if (!isModified) {
      setShowCta(false);
    }
  }, [isModified, showCta]);

  const sidebarContent = (
    <>
      {/* Light / Dark mode toggle */}
      <div className="flex items-center rounded-lg border border-border p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode('light')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'light'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sun className="h-3.5 w-3.5" />
          Light
        </button>
        <button
          type="button"
          onClick={() => setMode('dark')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === 'dark'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Moon className="h-3.5 w-3.5" />
          Dark
        </button>
      </div>

      <Section title="Colors">
        <div className="space-y-4">
          <ColorPairInput
            label="Base"
            bgValue={tokens.backgroundColor}
            fgValue={tokens.foregroundColor}
            onBgChange={(v) => updateToken('backgroundColor', v)}
            onFgChange={(v) => updateToken('foregroundColor', v)}
          />
          <ColorPairInput
            label="Primary"
            bgValue={tokens.primaryColor}
            fgValue={tokens.primaryForeground}
            onBgChange={(v) => updateToken('primaryColor', v)}
            onFgChange={(v) => updateToken('primaryForeground', v)}
          />
          <ColorPairInput
            label="Secondary"
            bgValue={tokens.secondaryColor}
            fgValue={tokens.secondaryForeground}
            onBgChange={(v) => updateToken('secondaryColor', v)}
            onFgChange={(v) => updateToken('secondaryForeground', v)}
          />
          <ColorPairInput
            label="Accent"
            bgValue={tokens.accentColor}
            fgValue={tokens.accentForeground}
            onBgChange={(v) => updateToken('accentColor', v)}
            onFgChange={(v) => updateToken('accentForeground', v)}
          />
          <ColorPairInput
            label="Destructive"
            bgValue={tokens.destructiveColor}
            fgValue={tokens.destructiveForeground}
            onBgChange={(v) => updateToken('destructiveColor', v)}
            onFgChange={(v) => updateToken('destructiveForeground', v)}
          />
          <ColorPairInput
            label="Success"
            bgValue={tokens.successColor}
            fgValue={tokens.successForeground}
            onBgChange={(v) => updateToken('successColor', v)}
            onFgChange={(v) => updateToken('successForeground', v)}
          />

          <div className="space-y-1.5">
            <span className="text-xs font-medium">Popover</span>
            <ColorRow
              label="Background"
              value={tokens.popoverColor}
              onChange={(v) => updateToken('popoverColor', v)}
            />
            <ColorRow
              label="Text"
              value={tokens.popoverForeground}
              onChange={(v) => updateToken('popoverForeground', v)}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium">Border & Input</span>
            <ColorRow
              label="Border"
              value={tokens.borderColor}
              onChange={(v) => updateToken('borderColor', v)}
            />
            <ColorRow
              label="Input"
              value={tokens.inputBorderColor}
              onChange={(v) => updateToken('inputBorderColor', v)}
            />
            <ColorRow
              label="Focus ring"
              value={tokens.ringColor}
              onChange={(v) => updateToken('ringColor', v)}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium">Chart</span>
            <ColorRow
              label="Chart 1"
              value={tokens.chart1}
              onChange={(v) => updateToken('chart1', v)}
            />
            <ColorRow
              label="Chart 2"
              value={tokens.chart2}
              onChange={(v) => updateToken('chart2', v)}
            />
            <ColorRow
              label="Chart 3"
              value={tokens.chart3}
              onChange={(v) => updateToken('chart3', v)}
            />
            <ColorRow
              label="Chart 4"
              value={tokens.chart4}
              onChange={(v) => updateToken('chart4', v)}
            />
            <ColorRow
              label="Chart 5"
              value={tokens.chart5}
              onChange={(v) => updateToken('chart5', v)}
            />
          </div>
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
    </>
  );

  const ctaBanner = (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${
        showCta ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
      }`}
    >
      <style>{`
        @keyframes vibrate {
          0%, 10% { transform: translateX(0); }
          2% { transform: translateX(-2px) rotate(-0.5deg); }
          4% { transform: translateX(2px) rotate(0.5deg); }
          6% { transform: translateX(-1px) rotate(-0.3deg); }
          8% { transform: translateX(1px) rotate(0.3deg); }
        }
        .cta-vibrate { animation: vibrate 3s ease-in-out infinite; }
      `}</style>
      <div className="border-t bg-foreground px-6 py-6">
        <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
          <p className="text-background text-center sm:text-left flex-1">
            Ship this theme in a MCP app in minutes.
          </p>
          <a
            href="https://manifest.build?ref=toolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-vibrate shrink-0 flex items-center justify-center gap-2 rounded-lg bg-background text-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Use with Manifest
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Mobile layout */}
      <div className="lg:hidden w-full">
        {/* Mobile header */}
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold tracking-tight">Customize</h1>
          <p className="text-sm text-muted-foreground">Adjust tokens and see changes live.</p>
        </div>

        {/* Mobile grid */}
        <div
          ref={mobileRef}
          className="p-4 pb-20 grid grid-cols-1 sm:grid-cols-2 gap-4 [&_input:focus-visible]:!border-[var(--ring)] [&_select:focus-visible]:!border-[var(--ring)] [&_textarea:focus-visible]:!border-[var(--ring)]"
        >
          {showcaseItems.map((item) => (
            <div key={item.label}>{item.component}</div>
          ))}
        </div>

        {/* Mobile fixed toggle button */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 shadow-lg hover:opacity-90 transition-opacity"
        >
          <Palette className="h-4 w-4" />
          <span className="text-sm font-medium">Customize</span>
        </button>

        {/* Mobile slide-over panel */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            {/* Panel */}
            <div className="relative ml-auto w-[300px] max-w-[85vw] h-full bg-card border-l shadow-xl overflow-y-auto animate-in slide-in-from-right duration-200">
              <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-card">
                <span className="text-sm font-semibold">Customize</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 pb-24 space-y-4">{sidebarContent}</div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:flex w-full">
        {/* Center: component grid — tokens scoped here only */}
        <div
          ref={previewRef}
          className="flex-1 p-8 pb-24 overflow-y-auto [&_input:focus-visible]:!border-[var(--ring)] [&_select:focus-visible]:!border-[var(--ring)] [&_textarea:focus-visible]:!border-[var(--ring)]"
        >
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">Customize</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Adjust design tokens on the right and see changes reflected across all components in
                real-time.
              </p>
            </div>
            <div className="columns-2 gap-6 [&>div]:mb-6 [&>div]:break-inside-avoid">
              {showcaseItems.map((item) => (
                <div key={item.label}>{item.component}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar: controls */}
        <aside className="w-[280px] shrink-0 border-l bg-card sticky top-[3.5rem] h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-5 pb-24 space-y-4">{sidebarContent}</div>
        </aside>
      </div>

      {/* Full-width CTA banner */}
      {ctaBanner}
    </div>
  );
}
