// ONBOARDING (migration 247) — the new-club setup wizard's state + step model.
// Each step teaches a concept AND writes real data. Core steps (club + season)
// gate entry to the app; the rest are optional and nudged from the dashboard.
export interface OnboardingState {
  steps: Record<string, boolean>
  started_at?: string | null
  completed_at?: string | null
  dismissed?: boolean
}

export interface OnboardingStepDef {
  key: string
  label: string
  icon: string
  core?: boolean   // core steps can't be skipped and gate app entry
}

// Order = wizard order. Keep in sync with the panes in /onboarding.
export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  { key: 'club',       label: 'Your club',        icon: 'pi-home',       core: true },
  { key: 'types',      label: 'People types',     icon: 'pi-id-card' },
  { key: 'season',     label: 'Your first season', icon: 'pi-clock',     core: true },
  { key: 'programmes', label: 'Programmes',       icon: 'pi-sitemap' },
  { key: 'class',      label: 'Your first class', icon: 'pi-users' },
  { key: 'fees',       label: 'Fees',             icon: 'pi-dollar' },
  { key: 'form',       label: 'Registration link', icon: 'pi-link' },
  { key: 'team',       label: 'Invite your team', icon: 'pi-user-plus' },
]

export function useOnboarding() {
  const db = useDb()
  const { orgId } = useOrg()

  function resolve(raw: any): OnboardingState {
    if (!raw || typeof raw !== 'object') return { steps: {} }
    return { steps: raw.steps ?? {}, started_at: raw.started_at ?? null, completed_at: raw.completed_at ?? null, dismissed: !!raw.dismissed }
  }

  async function load(org = orgId.value): Promise<OnboardingState> {
    if (!org) return { steps: {} }
    const { data } = await (db.from as any)('organisations').select('onboarding').eq('id', org).maybeSingle()
    return resolve(data?.onboarding)
  }

  async function save(state: OnboardingState, org = orgId.value): Promise<void> {
    if (!org) return
    await (db.from as any)('organisations').update({ onboarding: state }).eq('id', org)
  }

  /** Mark a step done (idempotent) and persist. */
  async function completeStep(key: string, state: OnboardingState, org = orgId.value): Promise<OnboardingState> {
    const next: OnboardingState = { ...state, steps: { ...state.steps, [key]: true }, started_at: state.started_at ?? new Date().toISOString() }
    await save(next, org)
    return next
  }

  function coreDone(state: OnboardingState): boolean {
    return ONBOARDING_STEPS.filter(s => s.core).every(s => state.steps?.[s.key])
  }
  function allDone(state: OnboardingState): boolean {
    return ONBOARDING_STEPS.every(s => state.steps?.[s.key])
  }
  function doneCount(state: OnboardingState): number {
    return ONBOARDING_STEPS.filter(s => state.steps?.[s.key]).length
  }
  /** Onboarding still needs the dashboard nudge? (started, core done, not fully done, not dismissed) */
  function needsNudge(state: OnboardingState): boolean {
    return !!state.started_at && !state.completed_at && !state.dismissed && !allDone(state)
  }

  return { ONBOARDING_STEPS, load, save, completeStep, coreDone, allDone, doneCount, needsNudge, resolve }
}
