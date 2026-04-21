export interface Crumb { label: string; to?: string }

export function useBreadcrumbs() {
  return useState<Crumb[]>('breadcrumbs', () => [])
}
