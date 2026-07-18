// ONBOARDING (migration 247) — a GUIDED SETUP CHECKLIST for a new club. Each
// step teaches a concept and links to the REAL page where you set it up (so you
// learn where things live and use the actual tools). Completion is DETECTED
// from real data — a step ticks itself the moment you've actually done it.
// State jsonb only remembers `dismissed` / `completed_at`.
export interface OnboardingState {
  dismissed?: boolean
  completed_at?: string | null
}

export interface OnboardingStepDef {
  key: string
  label: string
  icon: string
  color: string
  blurb: string       // plain-English teaching line
  to: string          // the REAL page to do it on
  cta: string
  core?: boolean      // core steps gate app entry
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  { key: 'club', core: true, label: 'Name your club', icon: 'pi-home', color: '#1E2157',
    blurb: 'Set your club name, sport and currency. Your sport shapes the words the app uses and who you can affiliate to.',
    to: '/settings', cta: 'Open General settings' },
  { key: 'types', label: 'Set up people types', icon: 'pi-id-card', color: '#8B5CF6',
    blurb: 'Every person you track is a type — Member, Parent, Coach… Add the standard set (one click) and tweak what info each one collects.',
    to: '/settings/fields', cta: 'Open People & Entities' },
  { key: 'season', core: true, label: 'Create your first season', icon: 'pi-clock', color: '#059669',
    blurb: 'A season (or term) is the date range your classes run in, with a sign-up window. Add “Term 1 2026”.',
    to: '/settings/terms', cta: 'Open Terms' },
  { key: 'programmes', label: 'Add your programmes', icon: 'pi-sitemap', color: '#3B82F6',
    blurb: 'Programmes group related classes — Recreational vs Competitive — and pass settings down to the classes inside.',
    to: '/groups/codes', cta: 'Organise programmes' },
  { key: 'class', label: 'Create your first class', icon: 'pi-users', color: '#0EA5E9',
    blurb: 'A class is a group who train together, with a time, coach and roster. Create one and add a weekly session.',
    to: '/groups', cta: 'Go to Classes' },
  { key: 'fees', label: 'Set your fees', icon: 'pi-dollar', color: '#D97706',
    blurb: 'How much it costs to join a class — one price, monthly, instalments, or free. Members pick when they register.',
    to: '/groups/fees', cta: 'Open Group fees' },
  { key: 'form', label: 'Create a registration form', icon: 'pi-file-edit', color: '#EC4899',
    blurb: 'A public sign-up form your members fill in — connect it to a class and share the link. No login needed to register.',
    to: '/forms', cta: 'Open Forms' },
  { key: 'team', label: 'Add your people', icon: 'pi-user-plus', color: '#DC2626',
    blurb: 'Add the coaches, admins and members who make up your club — import them or add a few to get going.',
    to: '/people', cta: 'Go to People' },
]

export function useOnboarding() {
  // The onboarding STATE (organisations.onboarding jsonb) is on the seam. detect()
  // still uses useDb: it COUNTS across seven other domains' tables (person_target_types,
  // org_terms, group_codes, member_groups, group_fee_options, registration_forms,
  // persons) — a cross-domain aggregate with no single owner, awaiting a counts
  // endpoint. Guarded: a null org / failed read just shows the checklist un-ticked.
  const db = useDb()
  const orgsApi = useOrganisationsApi()
  const { orgId } = useOrg()

  function resolve(raw: any): OnboardingState {
    if (!raw || typeof raw !== 'object') return {}
    return { dismissed: !!raw.dismissed, completed_at: raw.completed_at ?? null }
  }
  async function loadState(org = orgId.value): Promise<OnboardingState> {
    if (!org) return {}
    return await orgsApi.getOnboarding(org)
  }
  async function saveState(state: OnboardingState, org = orgId.value): Promise<void> {
    if (!org) return
    await orgsApi.setOnboarding(org, state)
  }

  /** DETECT which steps are complete from real data. Returns a { key: bool } map. */
  async function detect(org = orgId.value): Promise<Record<string, boolean>> {
    if (!org) return {}
    const head = (table: string, extra?: (q: any) => any) => {
      let q = (db.from as any)(table).select('id', { count: 'exact', head: true }).eq('org_id', org)
      return (extra ? extra(q) : q)
    }
    const [org1, types, terms, codes, classes, fees, forms, people] = await Promise.all([
      (db.from as any)('organisations').select('name').eq('id', org).maybeSingle(),
      head('person_target_types'),
      head('org_terms'),
      head('group_codes'),
      head('member_groups', (q: any) => q.neq('kind', 'membership')),
      head('group_fee_options'),
      head('registration_forms'),
      head('persons'),
    ])
    return {
      club: !!(org1?.data?.name && org1.data.name.trim()),
      types: (types.count ?? 0) > 0,
      season: (terms.count ?? 0) > 0,
      programmes: (codes.count ?? 0) > 0,
      class: (classes.count ?? 0) > 0,
      fees: (fees.count ?? 0) > 0,
      form: (forms.count ?? 0) > 0,
      team: (people.count ?? 0) > 1,
    }
  }

  function coreDone(done: Record<string, boolean>): boolean {
    return ONBOARDING_STEPS.filter(s => s.core).every(s => done[s.key])
  }
  function allDone(done: Record<string, boolean>): boolean {
    return ONBOARDING_STEPS.every(s => done[s.key])
  }
  function doneCount(done: Record<string, boolean>): number {
    return ONBOARDING_STEPS.filter(s => done[s.key]).length
  }

  return { ONBOARDING_STEPS, loadState, saveState, detect, coreDone, allDone, doneCount, resolve }
}
