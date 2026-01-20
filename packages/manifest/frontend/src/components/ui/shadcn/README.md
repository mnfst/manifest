# shadcn/ui Components

**DO NOT MODIFY THESE FILES**

This folder contains components from [shadcn/ui](https://ui.shadcn.com/), installed via `npx shadcn@latest add`.

## Rules

1. **Never edit these files directly** - They are maintained by the shadcn/ui project
2. **To update a component** - Run `npx shadcn@latest add <component-name>` to get the latest version
3. **For customizations** - Create a wrapper component in `../` (parent folder) instead
4. **For bug fixes** - Check if it's fixed in a newer shadcn version first

## Custom Components

Custom components that are NOT from shadcn/ui live in the parent folder (`../`):
- `select.tsx` - Custom native select with options array prop
- `stats.tsx` - Custom statistics display component

## Why This Separation?

- shadcn components are designed to be copied and owned, but we keep them pristine for easy updates
- Custom components can be freely modified to fit our needs
- Clear separation prevents accidental modifications to shadcn source

## Updating shadcn Components

```bash
# Update a specific component
npx shadcn@latest add button --overwrite

# Or update all (be careful, review changes)
npx shadcn@latest add --all --overwrite
```

---
*Added: commit b09572e - "feat: install shadcn/ui components and auto-discover for preview"*
