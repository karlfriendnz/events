// Field engine — resolves the inherited "member fields" form chain for an org.
// Built on the existing FormBuilder/registration_forms: each org owns a
// member-fields form (organisations.member_form_id); a club inherits its
// ancestors' member forms (e.g. NSO-required fields) plus its own.

export interface FieldPolicyLink {
  orgId: string
  orgName: string
  orgLevel: string
  formId: string
  inherited: boolean // true = from an ancestor (read-only downstream)
}

export function useOrgFieldPolicy() {
  const db = useDb()
  const { ancestors } = useOrgHierarchy()

  /** Ordered top-ancestor → self. Only orgs that actually have a member form. */
  async function resolveChain(orgId: string): Promise<FieldPolicyLink[]> {
    const anc = await ancestors(orgId) // immediate parent first, increasing upward
    const ids = [orgId, ...anc.map(a => a.id)]
    const { data: rows } = await (db.from as any)('organisations')
      .select('id, name, org_level, member_form_id')
      .in('id', ids)
    const byId = new Map((rows ?? []).map((r: any) => [r.id, r]))
    // order: top ancestor first … self last
    const ordered = [...anc].reverse().map(a => byId.get(a.id)).filter(Boolean)
    const self = byId.get(orgId)
    if (self) ordered.push(self)
    return (ordered as any[])
      .filter(o => o.member_form_id)
      .map(o => ({ orgId: o.id, orgName: o.name, orgLevel: o.org_level, formId: o.member_form_id, inherited: o.id !== orgId }))
  }

  /** Load the fields of a form (for previewing inherited fields). */
  async function formFields(formId: string) {
    const { data } = await (db.from as any)('form_fields')
      .select('id, label, field_type, is_required, help_text, sort_order')
      .eq('form_id', formId).order('sort_order')
    return data ?? []
  }

  return { resolveChain, formFields }
}
