import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Input Component - ChatGPT UI Guidelines Compliant
 * - No duplicative inputs (don't replicate ChatGPT features in cards)
 * - Consistent border radius with system
 * - Simple direct edits where appropriate
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-lg border bg-transparent px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-foreground",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
