import type { ThemeVariables } from '@chatgpt-app-builder/shared';
import { ThemeProvider } from '../editor/ThemeProvider';
import { Button } from '../ui/shadcn/button';
import { Switch } from '../ui/shadcn/switch';
import { Checkbox } from '../ui/shadcn/checkbox';
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface ThemePreviewProps {
  /** Current theme variables to apply */
  themeVariables: ThemeVariables;
}

/**
 * Default preview component for the theme editor
 * Shows sample shadcn components styled with current theme
 * Can be replaced with a custom preview component via ThemeEditor props
 */
export function ThemePreview({ themeVariables }: ThemePreviewProps) {
  const [switchChecked, setSwitchChecked] = useState(true);

  return (
    <ThemeProvider themeVariables={themeVariables}>
      <div className="p-6 bg-background rounded-lg border border-border">
        {/* Horizontal layout for preview sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card & Buttons */}
          <div className="space-y-4">
            <div className="bg-card text-card-foreground rounded-lg border border-border p-4 shadow-sm">
              <h4 className="font-medium mb-2">Card</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Sample card with muted text.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm">Primary</Button>
                <Button size="sm" variant="secondary">Secondary</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline">Outline</Button>
              <Button size="sm" variant="destructive">Destructive</Button>
              <Button size="sm" variant="ghost">Ghost</Button>
            </div>
          </div>

          {/* Form elements */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Input
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Type something..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Select
              </label>
              <select className="w-full px-3 py-2 text-sm bg-background text-foreground border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring">
                <option>Option 1</option>
                <option>Option 2</option>
              </select>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Checkbox id="preview-checkbox" defaultChecked />
                <label htmlFor="preview-checkbox" className="text-sm text-foreground">
                  Checkbox
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={switchChecked} onCheckedChange={setSwitchChecked} />
                <span className="text-sm text-foreground">Switch</span>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Alerts</p>
            <div className="flex items-start gap-2 p-2 rounded-md border border-border bg-card">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-foreground">Info message</p>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-md bg-accent/50 border border-accent">
              <CheckCircle2 className="w-4 h-4 text-accent-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-accent-foreground">Success message</p>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-xs text-destructive">Error message</p>
            </div>
          </div>

          {/* Color swatches */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Colors</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="aspect-square rounded-md bg-primary" title="Primary" />
              <div className="aspect-square rounded-md bg-secondary" title="Secondary" />
              <div className="aspect-square rounded-md bg-accent" title="Accent" />
              <div className="aspect-square rounded-md bg-muted" title="Muted" />
              <div className="aspect-square rounded-md bg-destructive" title="Destructive" />
              <div className="aspect-square rounded-md bg-card border border-border" title="Card" />
              <div className="aspect-square rounded-md bg-popover border border-border" title="Popover" />
              <div className="aspect-square rounded-md bg-background border border-border" title="Background" />
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
