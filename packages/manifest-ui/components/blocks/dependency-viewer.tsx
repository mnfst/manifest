import { useEffect, useState } from 'react'

const FILTERED_DEPS = new Set(['lucide-react'])

export function useExternalDepCount(registryName: string): number | null {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    async function fetchDeps() {
      if (!registryName) return
      try {
        const res = await fetch(`/r/${registryName}.json`)
        if (!res.ok) return
        const data = await res.json()
        const deps = (data.dependencies || []) as string[]
        const devDeps = (data.devDependencies || []) as string[]
        const total = deps.filter(d => !FILTERED_DEPS.has(d)).length +
          devDeps.filter(d => !FILTERED_DEPS.has(d)).length
        setCount(total)
      } catch {
        // ignore
      }
    }
    fetchDeps()
  }, [registryName])

  return count
}

interface DependencyViewerProps {
  dependencies: string[]
  devDependencies: string[]
  loading: boolean
}

function NpmLink({ pkg }: { pkg: string }) {
  return (
    <a
      href={`https://www.npmjs.com/package/${pkg}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-sm font-mono hover:bg-muted/80 hover:text-foreground transition-colors"
    >
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 256 256"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="npm"
      >
        <rect fill="#C12127" width="256" height="256" rx="8" />
        <path fill="#fff" d="M48 48h160v160h-32V80h-48v128H48z" />
      </svg>
      {pkg}
    </a>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 bg-muted rounded w-48" />
      <div className="flex flex-wrap gap-2">
        <div className="h-8 bg-muted rounded w-28" />
        <div className="h-8 bg-muted rounded w-32" />
      </div>
    </div>
  )
}

export function hasExternalDeps(
  dependencies: string[],
  devDependencies: string[]
): boolean {
  return dependencies.some(d => !FILTERED_DEPS.has(d)) ||
    devDependencies.some(d => !FILTERED_DEPS.has(d))
}

export function DependencyViewer({
  dependencies,
  devDependencies,
  loading
}: DependencyViewerProps) {
  if (loading) {
    return <LoadingSkeleton />
  }

  const filteredDeps = dependencies.filter(d => !FILTERED_DEPS.has(d))
  const filteredDevDeps = devDependencies.filter(d => !FILTERED_DEPS.has(d))

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Installing this component will also install the following packages:
      </p>

      {filteredDeps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Packages
          </h4>
          <div className="flex flex-wrap gap-2">
            {filteredDeps.map(dep => (
              <NpmLink key={dep} pkg={dep} />
            ))}
          </div>
        </div>
      )}

      {filteredDevDeps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Dev Packages
          </h4>
          <div className="flex flex-wrap gap-2">
            {filteredDevDeps.map(dep => (
              <NpmLink key={dep} pkg={dep} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
