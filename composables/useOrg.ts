export function useOrg() {
  const orgId = useState<string | null>('orgId', () => null)
  const orgReady = useState<boolean>('orgReady', () => false)
  return { orgId, orgReady }
}
