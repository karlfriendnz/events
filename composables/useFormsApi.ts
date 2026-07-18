// The client side of the seam for forms & registration. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed domain
// objects (the shared contract), so a component has no idea whether the data came
// from MySQL today or the backend team's API tomorrow.
import type {
  FormField,
  FormFieldInput,
  FormSubmission,
  FormUsageMap,
  RegistrationForm,
  RegistrationFormTarget,
  RegistrationFormCreate,
  RegistrationFormPatch,
} from '../shared/contracts/form'

export function useFormsApi() {
  /** Every registration form for an org, newest first. */
  async function list(orgId: string): Promise<RegistrationForm[]> {
    return await $fetch<RegistrationForm[]>('/api/v1/forms', { query: { orgId } })
  }
  /** One registration form by id. */
  async function get(id: string): Promise<RegistrationForm> {
    return await $fetch<RegistrationForm>(`/api/v1/forms/${id}`)
  }
  /** The connections of one form (codes / groups it registers into). */
  async function targets(formId: string): Promise<RegistrationFormTarget[]> {
    return await $fetch<RegistrationFormTarget[]>(`/api/v1/forms/${formId}/targets`)
  }
  /** The ordered fields of one legacy (builder-shaped) form. Empty for designer forms. */
  async function fields(formId: string): Promise<FormField[]> {
    return await $fetch<FormField[]>(`/api/v1/forms/${formId}/fields`)
  }
  /** Replace the whole field set of a form (delete-then-insert). */
  async function saveFields(formId: string, list: FormFieldInput[]): Promise<void> {
    await $fetch(`/api/v1/forms/${formId}/fields`, { method: 'POST', body: { fields: list } })
  }
  /** Replace the whole connection set of a form (delete-then-insert). */
  async function saveTargets(
    formId: string,
    orgId: string,
    list: { targetType: string; targetId: string; sortOrder: number }[],
  ): Promise<void> {
    await $fetch(`/api/v1/forms/${formId}/targets`, { method: 'POST', body: { orgId, targets: list } })
  }
  /** Per-form usage tallies (fields / in-use / connections) for an org, keyed by form id. */
  async function usage(orgId: string): Promise<FormUsageMap> {
    return await $fetch<FormUsageMap>('/api/v1/forms/usage', { query: { orgId } })
  }
  /** Submissions for an org, newest first — optionally by form and/or paged. */
  async function submissions(
    orgId: string,
    opts: { limit?: number; offset?: number; formId?: string } = {},
  ): Promise<FormSubmission[]> {
    return await $fetch<FormSubmission[]>('/api/v1/form-submissions', {
      query: { orgId, ...opts },
    })
  }
  async function create(input: RegistrationFormCreate): Promise<RegistrationForm> {
    return await $fetch<RegistrationForm>('/api/v1/forms', { method: 'POST', body: input })
  }
  async function update(id: string, patch: RegistrationFormPatch): Promise<RegistrationForm> {
    return await $fetch<RegistrationForm>(`/api/v1/forms/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a form. Pass orgId to also DETACH everything pointing at it (events /
   *  booking modes / classes get form_id nulled, fields + connections removed) and
   *  scope the delete to the org; omit it for a plain row delete. */
  async function remove(id: string, orgId?: string): Promise<void> {
    await $fetch(`/api/v1/forms/${id}`, { method: 'DELETE', query: orgId ? { orgId } : undefined })
  }
  return { list, get, targets, fields, saveFields, saveTargets, usage, submissions, create, update, remove }
}
