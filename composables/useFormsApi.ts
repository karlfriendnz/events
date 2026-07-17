// The client side of the seam for forms & registration. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed domain
// objects (the shared contract), so a component has no idea whether the data came
// from MySQL today or the backend team's API tomorrow.
import type {
  FormSubmission,
  RegistrationForm,
  RegistrationFormTarget,
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
  /** Submissions for an org, newest first — optionally by form and/or paged. */
  async function submissions(
    orgId: string,
    opts: { limit?: number; offset?: number; formId?: string } = {},
  ): Promise<FormSubmission[]> {
    return await $fetch<FormSubmission[]>('/api/v1/form-submissions', {
      query: { orgId, ...opts },
    })
  }
  return { list, get, targets, submissions }
}
