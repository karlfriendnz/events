# FriendlyManager Events — Codebase Guide

---

## URL → File Lookup

Given any URL, find the file and what to expect instantly.

| URL pattern | File | Lines | Notes |
|---|---|---|---|
| `/` | `pages/index.vue` | 4 | Redirects to `/events` |
| `/login` | `pages/login.vue` | 126 | Auth page, uses `useSupabaseClient()` directly |
| `/events` | `pages/events/index.vue` | 1059 | Event list with search, filters, calendar toggle |
| `/events/new` | `pages/events/new.vue` | 27 | Redirect stub → `/events/new-basic` |
| `/events/new-basic` | `pages/events/new-basic.vue` | 761 | Single-event creation wizard |
| `/events/new-advanced` | `pages/events/new-advanced.vue` | 742 | Advanced event form; Sessions step uses `<BulkSessionTemplates>` to generate sessions across programme days |
| `/events/new-multi` | `pages/events/new-multi.vue` | 285 | Bulk event creation from templates |
| `/events/reporting` | `pages/events/reporting.vue` | 292 | Event analytics/reporting |
| `/events/:id` | `pages/events/[id].vue` | **~8230** | **Main event editor** — see tab breakdown below |
| `/bookables` | `pages/bookables/index.vue` | ~90 | **Unified page** with centered pill tabs — renders `<BookingsList>`, `<BookablesList>`, `<ActivitiesList>`, `<BookingDiscountsList>`, or `<AccessControlList>`. Bookings tab hidden when no active bookables exist. `<BookablesList>` itself has inner Venues/Persons/Items/**Archived** sub-tabs (Archived only shown when count > 0). Venues view groups each top-level facility into its own card, with depth-0 expanded by default and any nested venue collapsed |
| ~~`/bookables/new`~~ | _removed_ | — | "New Venue" inserts a draft `bookables` row + redirects to `/bookables/:id?new=1` (Details tab opens automatically). Same path used by the "Add Sub-venue" / "Add Item" buttons via `createChildBookable()` |
| `/bookables/:id` | `pages/bookables/[id].vue` | ~2160 | Venue detail — wraps `<BookableEditor>` in tabs + Sub-venues tab with venue map and Configurations panel |
| `/bookings/new` | `pages/bookings/new.vue` | 6 | **Thin wrapper** → `<BookingWizard staff />` |
| `/book` | `pages/book/index.vue` | 7 | **Thin wrapper** → `<BookingWizard />` (public, reads `?org=`) |
| `/activities/:id` | `pages/activities/[id]/index.vue` | ~720 | Activity detail — Details card (incl. image upload at bottom), modes list, back button to `/bookables?tab=activities` |
| `/activities/:id/modes/new` | `pages/activities/[id]/modes/[modeId].vue` | ~697 | New mode (modeId === 'new') |
| `/activities/:id/modes/:modeId` | `pages/activities/[id]/modes/[modeId].vue` | ~697 | Edit existing mode — 3 tabs (Details / Pricing / Add-ons). Details has Capacity card + **Required configuration** picker (uses `activity_modes.configuration_key`) + **Bookable scope** card (writes `activity_mode_bookables`) |
| `/settings` | `pages/settings/index.vue` | 1247 | Org settings — members, billing, fields, etc. |
| `/settings/calendars` | `pages/settings/calendars.vue` | 356 | Calendar integrations |
| `/settings/venues` | `pages/settings/venues.vue` | 148 | Venue tree editor (uses `<BookableEditor>`) |
| `/finances` | `pages/finances/index.vue` | 402 | Financial reporting |
| `/reporting` | `pages/reporting/index.vue` | 255 | General reporting |
| `/registration` | `pages/registration/index.vue` | 240 | Registration management |
| `/forms` | `pages/forms/index.vue` | ~80 | Forms list — shows all `registration_forms` with field counts and usage |
| `/forms/new` and `/forms/:id` | `pages/forms/[id].vue` | ~150 | **Thin wrapper** around `<FormBuilder>`; persists to `registration_forms` (config jsonb) + `form_fields`; round-trips via `?return=...&form_id=...` |

---

## Tab Breakdown — Frequently Edited Pages

### `/events/:id` → `pages/events/[id].vue`
The largest file (8326 lines). Each tab is a major section:

| Tab key | What it shows | Key components |
|---|---|---|
| `overview` | Summary card, quick stats | `<EventDetailsCard>` |
| `sessions` | Session list + inline editor | `<SessionEditor>`, `<BulkSessionTemplates>` |
| `invitees` | Invite groups/individuals | `<EventInviteeManager>`, `<InviteeGroupPicker>` |
| `forms` | Registration form builder | `<ConditionEditor>` |
| `discounts` | Discount codes | inline |
| `tickets` | Ticket types | inline |
| `communication` | Emails/notifications | inline |
| `automation` | Automation rules | inline |

### `/bookables/:id` → `pages/bookables/[id].vue`
Wraps `<BookableEditor>` plus extra tabs:

| Tab key | What it shows | Key components / DB tables |
|---|---|---|
| `bookings` | Booking calendar for this venue | `<BookingsCalendar>` → `bookings` |
| `details` | Venue info, modes | `<BookableEditor>` → `bookables`, `bookable_modes` |
| `availability` | Availability rules calendar | `<AvailabilityEditor>` → `availability_rules` |
| `sub-venues` | Visual venue map (click-to-select tiles) + **Configurations panel** below it | inline map → `bookables`; configurations → `bookable_configurations` + `bookable_configuration_children` |
| `items` | Items/equipment | inline → `bookable_items` |

**Layouts are gone** — the old `bookable_layouts` table was dropped (migration 107). Sub-divisions now live as actual sub-venue rows + `bookable_configurations` slot groups.

### `/bookables/:id` → `<BookableEditor>` internal tabs (in Details tab)

| Tab key | What it edits | DB columns |
|---|---|---|
| `details` | Name, description, location, features | `bookables.*` |
| `modes` | Booking modes (e.g. "Singles", "Doubles") | `bookable_modes` |
| `activities` | Linked activities | `activity_bookables` |
| `rules` | Max concurrent, booking limits, options | `bookables.booking_limit_type`, `.disallow_concurrent`, etc. |
| `images` | Photos | `bookables.images`, `.main_image` |

### `/activities/:id` → `pages/activities/[id]/index.vue`
Header has back button → `/bookables?tab=activities`. Two-column body — no tabs:
- **Left column**: Details card (Name, Description, Colour, Status, Bookings enabled, Area name, **Image upload** at bottom), Venues card, Booking link card, Groups card, **Booking settings card** (`approval_mode`, `booking_window_days`, `min_notice_hours`, `cancellation_window_hours`, `min_duration_mins`, `max_duration_mins`, `buffer_mins`)
- **Right column**: Modes table (click row → `/activities/:id/modes/:modeId`)

### `/activities/:id/modes/:modeId` → `pages/activities/[id]/modes/[modeId].vue`

| Tab key | What it edits | Key components |
|---|---|---|
| `details` | Name, colour, image, **Capacity** card | `<AppCard>`, `<SettingsRow>` |
| `pricing` | Default pricing + per-tier overrides | `<ModePricingTiersEditor>` |
| `addons` | Optional extras (tables, lanes, etc.) | `<ModeAddonsEditor>` |

### Activity `booking_flow` — wizard vs scheduler
Each activity row has a `booking_flow` column:
- `'wizard'` (default) → `<BookingWizard>` — multi-step flow described below
- `'scheduler'` → `<BookingScheduler>` — single-screen grid + side panel; slot-aware (see Phase 2 booking integrity below)

Set per-activity in the activity detail page.

### `/bookings/new` (staff) and `/book` (public)
Both are multi-step wizards with similar step keys:

| Step key | What it does |
|---|---|
| `activity` | Pick activity |
| `mode` | Pick mode |
| `resource` | Pick venue/court |
| `datetime` | Pick date + time slot |
| `addons` | Select add-ons |
| `details` | Attendee info |
| `review` | Summary + confirm |

---

## UI Label → Code Location

If the user says a section title, card heading, or tab name, look it up here to find the exact file and area.

| What you see in the UI | File | Where |
|---|---|---|
| **"Bookings enabled"** toggle | `pages/activities/[id]/index.vue` | Details card, below Status |
| **"Area name"** (singular/plural) | `pages/activities/[id]/index.vue` | Details card, below Bookings enabled |
| **"Booking settings"** card | `pages/activities/[id]/index.vue` | ~line 155, left column, `<AppCard>` |
| **"Booking behaviour"** toggles | `pages/activities/[id]/index.vue` | Inside Booking settings card, below Buffer time |
| **"Approval"** row (Auto-approved / Requires approval) | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Advance window"** row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Min notice"** row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Cancellation"** row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Duration"** (min/max) row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Buffer time"** row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Modes"** table (activity) | `pages/activities/[id]/index.vue` | right column; click row → mode edit page |
| **"Venues"** card (activity) | `pages/activities/[id]/index.vue` | left column, ~line 62 |
| **"Groups"** card (activity) | `pages/activities/[id]/index.vue` | left column, ~line 117 |
| **"Booking link"** card | `pages/activities/[id]/index.vue` | left column, ~line 94 |
| **"Capacity"** card | `pages/activities/[id]/modes/[modeId].vue` | Details tab, `<AppCard>` |
| **"Allow visitors"** toggle | `pages/activities/[id]/modes/[modeId].vue` | inside Capacity card |
| **"Details"** tab (mode) | `pages/activities/[id]/modes/[modeId].vue` | `activeTab === 'details'` |
| **"Pricing"** tab (mode) | `pages/activities/[id]/modes/[modeId].vue` | `<ModePricingTiersEditor>` |
| **"Add-ons"** tab (mode) | `pages/activities/[id]/modes/[modeId].vue` | `<ModeAddonsEditor>` |
| **"Default pricing"** section | `components/ModePricingTiersEditor.vue` | top of component |
| **"Pricing tiers"** section | `components/ModePricingTiersEditor.vue` | below default pricing |
| **"Limit for number of bookings"** | `components/BookableEditor.vue` | Rules tab, ~line 644 |
| **"Options"** (Disallow concurrent/consecutive) | `components/BookableEditor.vue` | Rules tab, ~line 666 |
| **"Max concurrent bookings"** | `components/BookableEditor.vue` | Rules tab, ~line 634 |
| **"Rules / notes"** textarea | `components/BookableEditor.vue` | Rules tab, ~line 638 |
| **"Details"** tab (venue editor) | `components/BookableEditor.vue` | `activeTab === 'details'` |
| **"Modes"** tab (venue editor) | `components/BookableEditor.vue` | `activeTab === 'modes'` |
| **"Activities"** tab (venue editor) | `components/BookableEditor.vue` | `activeTab === 'activities'` |
| **"Rules"** tab (venue editor) | `components/BookableEditor.vue` | `activeTab === 'rules'` |
| **"Availability rules"** calendar | `components/AvailabilityEditor.vue` | full component |
| **"Date Range"** on availability rule | `components/AvailabilityEditor.vue` | form panel, DatePicker pair |
| **"Booking windows"** | `components/BookableScheduleEditor.vue` | full component |
| **"Fee Groups"** | `components/FeeGroupsEditor.vue` | full component |
| **"Add-ons"** (session) | `components/SessionAddonsEditor.vue` | full component; used in `SessionEditor` |
| **"Add-ons"** tab (events/:id) | `pages/events/[id].vue` | `tab-addons` slot in SessionEditor |
| **"Sessions"** tab (events/:id) | `pages/events/[id].vue` | `activeTab === 'sessions'`, session list |
| **"Invitees"** tab (events/:id) | `pages/events/[id].vue` | `<EventInviteeManager>` |
| **"Visibility & Access"** | `pages/events/new-advanced.vue` or `[id].vue` | event settings section |
| **"Bookings"** tab (venue/:id) | `pages/bookables/[id].vue` | `<BookingsCalendar>` |
| **"Availability"** tab (venue/:id) | `pages/bookables/[id].vue` | `<AvailabilityEditor>` |
| **"Sub-venues"** tab (venue/:id) | `pages/bookables/[id].vue` | venue map + Configurations panel |
| **"Configurations"** panel (sub-venues tab) | `pages/bookables/[id].vue` | below the venue map; rows show `slot_name = child + child` chips; edit dialog manages slots |
| **"Set up a sport"** button (toolbar + empty state) | `components/BookablesList.vue` | opens `<SetupWizard>` |
| **"Required configuration"** picker (mode editor) | `pages/activities/[id]/modes/[modeId].vue` | Details tab; binds to `form.configuration_key`; options come from `bookable_configurations` rows on the activity's linked bookables, deduped by key |
| **"Bookable scope"** card (mode editor) | `pages/activities/[id]/modes/[modeId].vue` | Details tab; persists to `activity_mode_bookables` |
| **"Tile selection + New configuration from selection"** | `pages/bookables/[id].vue` | Sub-venues tab — clicking a child tile on the venue map toggles selection; "New configuration from selection" opens the dialog pre-filled with one slot |
| **"Eligibility"** / conditions | `components/ConditionEditor.vue` | full component |
| **"Registration Window"** | `pages/settings/index.vue` | settings tab |
| **"Calendars"** settings | `pages/settings/calendars.vue` | full page |
| **"Venues"** settings | `pages/settings/venues.vue` | `<BookableEditor>` + `<BookableTreeNode>` |

---

## Stack
- **Nuxt 3** (`ssr: false`) — file-based routing, auto-imports, `<script setup lang="ts">`
- **Vue 3** — Composition API, `reactive()` for forms, `ref()` for scalars
- **PrimeVue v4** — InputText, InputNumber, Select, ToggleSwitch, Button, Dialog, DataTable, DatePicker, etc.
- **Supabase** — Postgres + auth + storage via `useDb()` (admin client)
- **Tailwind CSS v3** + `tailwindcss-primeui` plugin
- **TypeScript** throughout

---

## Key Conventions

### DB Access
Always use `useDb()` — never `useSupabaseClient()` directly in pages/components.
```ts
const db = useDb()
const { data, error } = await (db.from as any)('table_name').select('*').eq('org_id', orgId.value)
```
The `(db.from as any)` cast bypasses stale generated types — intentional.

### Org Context
```ts
const { orgId } = useOrg()   // always scope queries to orgId.value
```

### Primary Brand Color
`#1E2157` → use Tailwind token: `bg-primary`, `text-primary`, `hover:bg-primary-hover`.
For PrimeVue Buttons (can't use Tailwind tokens there): `style="background:#1E2157;border-color:#1E2157"`.

---

## Domain Types — `/types/index.ts`
```ts
import type { Bookable, Activity, ActivityMode, Session, Booking, FMEvent } from '~/types'
// Also re-exports: FeeLineItem, FeeGroup, SessionFeesConfig from useFeeGroups
```

---

## Composables

| Composable | Exports |
|---|---|
| `useDb()` | Supabase admin client |
| `useOrg()` | `{ orgId, orgReady }` |
| `useFeeGroups` | Types + `feeTotal()`, `getSessionFee()`, `defaultFeesConfig()` |
| `useListEditor(getValue, setValue)` | `{ add, remove, patch, move, reorder }` for `{ id }[]` lists |
| `useLocation` | `LocationEntry` type + `locationSummary()` |
| `useRepeatOptions` | `buildRepeatOptions()`, `rruleToSummary()` |
| `useUpload` | `uploadFile(file)` → `{ url }` |
| `useMenuBookables()` | `{ items, reload }` for nav sidebar |
| `useBreadcrumbs()` | Sets layout header breadcrumbs |
| `useCalendarSettingsOpen()` | Boolean ref for calendar settings panel |
| `useBookingDiscounts()` | `{ loadActive, qualifies, bestMatch, amountForDiscount }` — evaluates discount rules against a `BookingContext` |
| `useBookingTokens` | `BOOKING_TOKENS` list + `substituteBookingTokens(template, ctx)` — pass `BOOKING_TOKENS` into `<FeeLineItemsTable :tokens>` so users can insert `{date}/{start_time}/{activity}/{venue}/...` into fee names |
| `useBookableConfigurations()` | `{ saveConfiguration, saveConfigurationFromChildIds }`. Idempotent slot-aware save against `bookable_configurations` + `bookable_configuration_children`. Used by `<SetupWizard>` and `pages/bookables/[id].vue` so both flows write the schema identically |

---

## Key Components

| Component | Purpose |
|---|---|
| `<AppCard title description>` | White rounded card — slots: `title`, `description`, `header-action`, default |
| `<SettingsRow label description tall>` | Label-left + content-right settings row |
| `<FeeLineItemsTable flush tokens>` | Draggable fee rows; name is a multi-line textarea (Shift+Enter for line break); `tokens` enables a `{·}` insert button for booking tokens |
| `<BookablesList>` / `<BookingsList>` / `<ActivitiesList>` / `<BookingDiscountsList>` / `<AccessControlList>` | Extracted tab contents rendered by the unified `/bookables` page |
| `<SessionEditor>` | Full session panel: dates, fees, add-ons, capacity |
| `<AvailabilityEditor>` | Drag-to-set availability calendar grid |
| `<BookableEditor standalone initialTab>` | Complete venue editor, emits `saved`, `cancel`, `delete` |
| `<BookingWizard staff?>` | **Single source of truth** for both `/book` (public) and `/bookings/new` (staff). 7-step wizard: Activity → Mode → Resource → Date/Time (calendar) → Add-ons → Details (form-driven via `<FormBuilder>`) → Review (with invoice). Form-driven Details step uses the mode's `form_id` if set, otherwise a synthetic default form (First Name, Last Name, Email, Phone, People Attending, Notes). Staff-only behavior gated on `staff` prop: categorized items accordion at Resource step (when items have `item_category`), event-link `<Select>` at Details, `checkCapacityViolation()` pre-submit check against `availability_rules.max_concurrent`, direct DB insert (RLS-enforced) instead of `/api/public-booking`, and visibility of non-public bookables. `event_id` saved on `bookings` row when staff links to an event. |
| `<BookingsCalendar>` | Calendar view of bookings for one venue |
| `<ModePricingTiersEditor>` | Default pricing + group tiers with inherit/override |
| `<ModeAddonsEditor>` | Add-ons list for activity modes |
| `<SessionAddonsEditor>` | Add-ons list for event sessions |
| `<LocationEditor>` | Location picker + live availability fetch |
| `<ConditionEditor>` | Recursive eligibility condition builder |
| `<EventInviteeManager>` | Add/remove invitees by group or individual |
| `<DateTimeEditor>` | DatePicker wrapper with time input |
| `<RepeatSelect>` | Recurrence rule selector |
| `<RichTextEditor>` | Markdown / rich-text editor |
| `<FormBuilder v-model context show-back can-delete>` | **Reusable** form builder — left section nav (Settings / Form / Terms) → per-section panels → field editor in sidebar; right pane is a live preview rendering fields via `<FormFieldCanvas>`. Used by `/forms/:id` and activity modes |
| `<FormFieldCanvas v-model editingKey pinnedRoles>` | Sortable field list with drag handles (`.field-drag-handle`), pin support (e.g. first/last name), inline previews per type (text/textarea/select/checkbox/date/file/email/phone/number) and block types (section/image/text-block/button). Used by `<FormBuilder>` and the events `/events/:id?tab=forms` field area |
| `<FormFieldAdvancedEditor field condition-field-options>` | Shared "Advanced" tab for the field editor — Visibility Conditions + Financial Rules (fee/discount). Mutates `field` by reference; self-contained add/remove/toggle handlers. Used by both `<FormBuilder>` (field editor sidebar) and `pages/events/[id].vue` (forms tab field editor) |
| `<EventFormDesignPanel design audience>` | Right-rail Settings panel for the events forms tab — audience pills, form style, header image source, info icons, description, form heading, add-person colour, page background, sponsors. Mutates `design` by reference; emits `back`, `save`, `update:audience`, `image-upload` |
| `<FormPreviewBanner design event>` | 220px-tall preview banner: custom header image, fallback gradient, optional `event.banner_url`, event title overlay |
| `<FormPreviewInfoIcons design event>` | Info-icons row (date / time / cost / location / criteria) — each toggled by `design.icons.<key>` |
| `<FormPreviewDescription design event>` | Switches between event-mode (read-only) and custom-mode (`<RichTextEditor v-model="design.customDescription">`) |
| `<FormPreviewPayment payment v-model:selected>` | Shows enabled payment methods (plan / credit_card / invoice / coupon) using `<FormsPaymentOptionCard>`; emits `update:selected` |
| `<PaymentOptionsEditor v-model defaultModel bankAccounts bankAccountId>` | Toggle-switch list of methods (Invoice / Credit Card / Payment Plan / Coupon) with optional "Default" badge + bank-account picker on Invoice. Used in `/settings` (org defaults for both bookings and events) and the activity-mode editor |
| `<SetupWizard v-model:visible @done>` | One-shot sport setup. Pick sport → name the facility → count of courts → tick preset modes (Singles, Mini-tennis, Kids coaching…). Wizard creates a top-level facility venue, N child courts (master + linked siblings), the **finest** required division as actual sub-venues (Q1–Q4 only — coarser configs become slot groupings), `bookable_configurations` rows for every picked mode's `requires`, the activity, the activity modes wired to `configuration_key`, `activity_bookables` linking activity → courts, and explicit `activity_mode_bookables` per-mode scope. Catalogue (sports + presetModes) lives inside the component. Entry from `<BookablesList>` toolbar + empty states |
| `<BookingScheduler activityId staff? presetBookableId presetStart presetEnd>` | Alternative to `<BookingWizard>` for activities with `booking_flow='scheduler'`. Single-screen: venue cards on left (auto-narrowed by mode scope + active configuration), SubVenueScheduler / BookingsCalendar grid, multi-slot drag select, sponsor strip; right pane builds the booking. Slot-aware: when a mode's `configuration_key` matches a configuration on the parent, picking a slot inserts one primary booking + N child bookings (linked via `parent_booking_id`) so every member sub-venue is blocked atomically. Initial `load()` and `venueGroups` watcher are wired in `onMounted` to avoid TDZ on `pendingModeId` / `allowMultiSlot` |
| `<VenueLibraryDialog v-model:visible @apply>` | Sport-themed picker with "Multiple [type]s" + "Configurations" tabs. Emits `{ type, division, configKey, configName, children, count, baseName }`. Used by the sub-venues tab on a parent venue's first sub-venue add |
| `<DivisionDiagram sections regions orientation courtType>` | SVG renderer for sport courts with section dividers — tennis lines, basketball keys, netball thirds, football pitch, cricket nets, pool lanes, sports hall badminton overlay. Falls back to plain emerald tiles when `courtType` is null. Used by `<VenueLibraryDialog>` |

---

## DB Schema — Key Tables

| Table | Important columns |
|---|---|
| `bookables` | `id, org_id, name, type, parent_id, master_id, max_concurrent, booking_limit_type, booking_limit_count, disallow_concurrent, disallow_consecutive, allow_modes_with_others, allow_sub_venues, rules, status, is_public, sections (text[])` |
| `bookable_modes` | `id, bookable_id, name, color, activity_mode_ids (uuid[])` |
| `bookable_configurations` | `id, parent_bookable_id, key, name, sort_order` — named layouts owned by a parent venue (e.g. Court 1 → Halves / Quarters). `unique(parent_bookable_id, key)` |
| `bookable_configuration_children` | `configuration_id, bookable_id, sort_order, slot_index, slot_name` — slot membership. A "Halves" config has two slot_indexes (0=Half A, 1=Half B); each slot can list multiple sub-venues (Half A = {Q1, Q2}). Booking the slot blocks every member atomically |
| `availability_rules` | `id, bookable_id, name, type, days (int[]), start_time, end_time, valid_from, valid_until` |
| `activities` | `id, org_id, name, description, color, icon, image_url, status, area_name_singular, area_name_plural, bookings_enabled, booking_flow ('wizard' \| 'scheduler'), approval_mode, booking_window_days, min_notice_hours, cancellation_window_hours, min_duration_mins, max_duration_mins, buffer_mins, allow_multi_slot, allow_multi_slot_peak, allow_kiosk, allow_recurring, allow_member_changes, auto_remove_unpaid, require_visitor_names, hide_member_names` |
| `activity_modes` | `id, activity_id, name, color, pricing (jsonb), addons (jsonb), allow_visitors, min_people, max_people, min_visitors, max_visitors, configuration_key, image_url, sort_order, approval_mode, form_id, default_booking_view, payment_options (jsonb)` — `configuration_key` (migration 109) is the configuration on the scoped/linked bookables that this mode requires |
| `activity_bookables` | `activity_id, bookable_id` (join table) |
| `activity_mode_bookables` | `mode_id, bookable_id` — per-mode scope (migration 108). Empty for a mode = "all activity bookables"; otherwise narrows the picker |
| `activity_groups` | `activity_id, group_id` (join table) |
| `sessions` | `id, event_id, start_at, end_at, status, fees (jsonb), addons (jsonb)` |
| `bookings` | `id, org_id, bookable_id, activity_id, activity_mode_id, start_at, end_at, status, parent_booking_id` — `parent_booking_id` (migration 111) self-FK so multi-bookable slot reservations show as one logical booking with N atomic children |
| `booking_discounts` | `id, org_id, name, form_text, modifier_type ('PERCENT'\|'FLAT'), modifier_value, apply_to, conditions (jsonb), valid_from, valid_until, max_uses, uses_count, is_active` |
| `booking_discount_activities` | `discount_id, activity_id` (join; empty on both = all) |
| `booking_discount_activity_modes` | `discount_id, activity_mode_id` (join; only used when scoping to specific modes within an activity) |
| `bookings` (discount cols) | `booking_discount_id, discount_amount` — set when public booking applies a discount |
| `member_groups` | `id, org_id, name, color` |

---

## Code Patterns

### Settings rows
```vue
<AppCard title="Booking settings" description="...">
  <div class="divide-y divide-gray-100">
    <SettingsRow label="Min notice" description="Before start time">
      <ToggleSwitch :modelValue="form.min_notice_hours !== null"
        @update:modelValue="v => form.min_notice_hours = v ? 2 : null" />
      <InputNumber v-if="form.min_notice_hours !== null" v-model="form.min_notice_hours" class="w-20" />
      <span v-else class="text-sm text-gray-400">None</span>
    </SettingsRow>
  </div>
</AppCard>
```

### List editors
```ts
const { add, remove, patch } = useListEditor(
  () => props.modelValue,
  v => emit('update:modelValue', v)
)
```

### Inline event handlers — never use TypeScript or if-statements
```vue
<!-- WRONG — template compiler rejects these -->
@change="if (x) y = null"
@change="(e: any) => handler(e)"

<!-- RIGHT -->
@change="onUnitChange"          <!-- named method -->
@click="x ? doA() : doB()"     <!-- ternary expression only -->
```

### Native `<select>` with PrimeVue
PrimeVue sets `appearance: none` globally. Restore with inline style:
```vue
<select :value="unit" style="-webkit-appearance:auto;appearance:auto;border:none;background:white;"
  @change="onUnitChange">
```
And handle the change event with a named method — no type annotations in the handler.

---

## Configuration / slot model (Phase 2 booking integrity)

Configurations are **named groups of slots**, where each slot lists physical sub-venues that get booked atomically together. So a Tennis Court that needs both halves and quarters has:
- Physical sub-venues: Q1, Q2, Q3, Q4 (the **finest** division — only level that exists as `bookables` rows)
- "Quarters" config: 4 slots, each one quarter
- "Halves" config: 2 slots — Half A = {Q1, Q2}, Half B = {Q3, Q4}

When a booking targets a slot, `<BookingScheduler>` inserts:
- One **primary** booking on the first member sub-venue (no `parent_booking_id`)
- One **child** booking per remaining member, each with `parent_booking_id` = primary's id

So booking "Half A" on Court 1 writes two `bookings` rows on Q1 and Q2 — both calendars show busy, no double-booking possible. The pre-flight check in `submit()` queries every member sub-venue across the picked slots before writing, aborting with a toast if any overlap exists.

**Known gap:** the calendar grid (`<BookingsCalendar>` / `<SubVenueScheduler>`) doesn't yet visually cross-block sub-venues sharing a slot — Q1's column shows free even when Q2 is booked in the same Halves slot. The pre-flight check stops the bad write; the visual polish is still to come.

---

## Migrations
Numbered sequentially in `/supabase/migrations/` (currently up to `112_`).
```bash
npx supabase db push   # no Docker needed — pushes to remote project
```

Recent migrations worth knowing:
- `108_activity_mode_bookables.sql` — per-mode bookable scope
- `109_bookable_configurations.sql` — `bookable_configurations` + `bookable_configuration_children` + `activity_modes.configuration_key`
- `110_configuration_slots.sql` — `slot_index` + `slot_name` on configuration children (multi-member slots like "Half A = Q1+Q2")
- `111_booking_parent_link.sql` — `bookings.parent_booking_id` (atomic multi-bookable slot reservations)
- `112_booking_indexes.sql` — `(bookable_id, start_at)` compound index hot-pathed by every availability check + conflict pre-flight; activity_id index; partial index on active statuses
