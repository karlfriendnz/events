export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000002'

export function useDb() {
  const client = useSupabaseClient()
  return client
}
