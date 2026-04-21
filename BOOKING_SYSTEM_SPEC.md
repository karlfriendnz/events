# Booking System — Implementation Spec

This document describes the full data model and implementation rules for the FriendlyManager
booking system. Use it to guide Claude when building UI, availability logic, and pricing engines.

---

## Worked Example: The Hall

> A hall that is open all week. On Tuesday 6–10 pm it becomes a basketball session split into
> 3 courts. Courts can be subdivided. Pricing varies by layout, membership tier, and time.

### Venue hierarchy

```
Hall  (bookable, type=VENUE)
 ├── Basketball Court 1  (bookable, type=VENUE, parent_id=Hall)
 ├── Basketball Court 2  (bookable, type=VENUE, parent_id=Hall)
 └── Basketball Court 3  (bookable, type=VENUE, parent_id=Hall)
```

Each **Basketball Court** has four layouts in `bookable_layouts`:

| Layout       | capacity_fraction | granularity |
|-------------|-------------------|-------------|
| Full Court  | 1.0               | FULL        |
| Half Court  | 0.5               | HALF        |
| Third Court | 0.3333            | THIRD       |
| Quarter Court | 0.25            | QUARTER     |

**Per-layout pricing** is stored in `bookable_layout_tiers` (layout_id × pricing_tier_id → price/price_type).

---

## Core concepts

### 1. Bookable hierarchy
- A **Venue** is a top-level bookable.
- **Sub-venues** use `parent_id` to nest inside a venue.
- Booking a sub-venue does **not** automatically block the parent — implement that check in app logic by verifying no conflicting parent booking exists and vice-versa.

### 2. Booking windows (`booking_windows`)
Define *when* a bookable accepts bookings.

| Column | Purpose |
|--------|---------|
| `window_type` | `OPEN` (any time in range), `SLOTTED` (auto-generated fixed-size slots), `FIXED` (specific named slots) |
| `days_of_week` | int[] 0=Mon … 6=Sun |
| `start_time` / `end_time` | wall-clock range |
| `slot_duration_mins` | OPEN/SLOTTED: slot size |
| `capacity` | how many simultaneous bookings in this window |

**Hall example windows:**

```
Hall:
  Window A — OPEN, every day, 00:00–18:00   (general hire, all week)
  Window B — OPEN, every day, 22:00–23:59   (late-night hourly, anyone)

Basketball Courts (each):
  Window C — SLOTTED, Tuesday only, 18:00–22:00, slot=60 min
              (basketball session)
  Window D — OPEN, every day, 22:00–23:59   (late-night open)
```

### 3. Layout capacity fractions (`bookable_layouts`)

New columns (migration 031):
- `capacity_fraction` — fraction of the parent resource occupied (0.0–1.0)
- `granularity` — string label; bookings at different granularities cannot coexist

**Availability algorithm for fractional layouts:**

```
Given: bookable_id, layout_id, start_at, end_at

1. Fetch all confirmed bookings on this bookable overlapping [start_at, end_at]
2. If any booking uses a layout with a DIFFERENT granularity → UNAVAILABLE
3. Sum capacity_fraction of all overlapping bookings
4. If sum + requested layout.capacity_fraction > 1.0 → UNAVAILABLE
5. Otherwise → AVAILABLE
```

**Example:**
- Court 1, Tuesday 7–8 pm. Half Court (0.5) booked by Alice.
- Bob tries to book Half Court (0.5): sum=0.5, 0.5+0.5=1.0 ≤ 1.0 → ✅ AVAILABLE
- Carol tries to book Full Court (1.0): granularity FULL ≠ HALF → ❌ UNAVAILABLE
- Dave tries to book Third Court (0.333): granularity THIRD ≠ HALF → ❌ UNAVAILABLE

### 4. Pricing tiers (`pricing_tiers`)

Each tier is per-bookable (bookable_id FK). For the Hall scenario:

| Tier   | Description |
|--------|-------------|
| Senior | Can book anytime — $10/session |
| Junior | Can only book 3 pm–7 pm — $20/session |
| Open   | Anyone, late-night only — simple hourly |

**Per-tier pricing per layout** lives in `bookable_layout_tiers`:
```
(layout_id=Half Court, pricing_tier_id=Senior) → price=$10, price_type=PER_SLOT
(layout_id=Half Court, pricing_tier_id=Junior) → price=$20, price_type=PER_SLOT
```

### 5. Tier time restrictions (`pricing_tier_restrictions`)

Migration 032. Each row restricts *when* a tier is allowed to book.

| Column | Meaning |
|--------|---------|
| `restriction_type` | `ALLOWED` = tier may ONLY book in this window; `BLOCKED` = tier may NOT book here |
| `days_of_week` | which days this applies |
| `start_time` / `end_time` | wall-clock bounds |

**Junior restriction example:**
```sql
insert into pricing_tier_restrictions
  (pricing_tier_id, restriction_type, days_of_week, start_time, end_time, label)
values
  (<junior_tier_id>, 'ALLOWED', '{0,1,2,3,4,5,6}', '15:00', '19:00', 'Junior hours');
```

**Availability algorithm with tier restrictions:**
```
1. Determine requested start_time/end_time wall-clock values
2. Fetch ALLOWED restrictions for the selected tier
3. If any ALLOWED rows exist:
   - Booking start_time must be >= restriction.start_time
   - Booking end_time must be <= restriction.end_time
   - day_of_week of booking date must be in restriction.days_of_week
   - If not satisfied → show "Not available for your tier at this time"
4. Check BLOCKED restrictions similarly
```

### 6. Venue-level flat price (Entire Hall = $100)

Model this as a **layout on the Hall bookable** itself (not the courts):

```
bookable_layouts: { bookable_id=Hall, name='Entire Venue', capacity_fraction=1.0, granularity='FULL' }
bookable_layout_tiers:
  (layout_id=Entire Venue, pricing_tier_id=Senior) → price=100, price_type=FIXED
  (layout_id=Entire Venue, pricing_tier_id=Junior) → price=100, price_type=FIXED
  (layout_id=Entire Venue, pricing_tier_id=Open)   → price=100, price_type=FIXED
```

When the Entire Venue layout is booked on the Hall, the app must also block all sub-venue
bookings that overlap in time (check parent_id chain).

### 7. Multi-court discount rules (`booking_discount_rules`)

Migration 033.

**Example — 20% off when booking 2+ Full Courts simultaneously:**
```sql
insert into booking_discount_rules
  (bookable_id, name, discount_percent, min_items, apply_to_granularity, same_session)
values
  (<hall_id>, '2-Court Discount', 20, 2, 'FULL', true);
```

**Discount application algorithm:**
```
At checkout, for each booking_discount_rule where bookable_id = hall (or parent):
1. Count how many items in the current booking session match apply_to_granularity
2. If count >= min_items AND same_session=true AND all overlap in time → apply discount_percent
3. Insert a DISCOUNT line item into booking_quote_items
```

### 8. Late-night window pricing (`booking_window_layout_prices`)

Migration 034. Overrides base layout pricing for a specific window.

**Example — after 10 pm, simple hourly by layout:**
```sql
-- Window D: every day, 22:00–23:59, OPEN
insert into booking_window_layout_prices (window_id, layout_id, price, price_type) values
  (<window_d_id>, <full_court_layout_id>,  30.00, 'PER_HOUR'),
  (<window_d_id>, <half_court_layout_id>,  18.00, 'PER_HOUR'),
  (<window_d_id>, <third_court_layout_id>, 12.00, 'PER_HOUR');
```

**Pricing resolution order (highest priority wins):**
1. `booking_window_layout_prices` — window-specific layout override
2. `booking_window_tiers` — window-specific tier override
3. `bookable_layout_tiers` — base layout/tier pricing
4. `pricing_rules` — fallback org-wide rules

---

## Components to build / update

### BookableScheduleEditor.vue
Already exists. Needs additions:
- [ ] Per-window layout price overrides tab/section (booking_window_layout_prices)
- [ ] Window capacity fraction awareness in the UI

### BookableEditor.vue — Layouts tab
Already shows layouts + tiers + modes. Needs:
- [ ] `capacity_fraction` input per layout (numeric 0–1, or fraction picker: Full/Half/Third/Quarter)
- [ ] `granularity` select per layout
- [ ] Tier time restrictions panel (link to pricing_tier_restrictions)

### Pricing tab on bookable detail page
Already shows booking_types, pricing_tiers, addons. Needs:
- [ ] Discount rules section (booking_discount_rules CRUD)
- [ ] Tier time restrictions (pricing_tier_restrictions CRUD) per tier

### Booking wizard (BookingWizard.vue / /bookings/new)
Core changes needed:
- [ ] Layout selection must run fractional availability check (see §3 algorithm)
- [ ] Tier selection must check pricing_tier_restrictions (see §5 algorithm)
- [ ] Pricing resolution must follow the 4-level priority (see §8)
- [ ] Discount rules applied automatically at line-item level
- [ ] Multi-sub-venue booking: allow user to pick multiple courts in one session

### Availability engine (new composable: `useAvailability.ts`)
Extract all availability + pricing logic into one composable so wizard and calendar share it:

```typescript
// useAvailability.ts
export async function getAvailableLayouts(
  bookableId: string,
  date: Date,
  startTime: string,
  endTime: string,
  pricingTierId: string | null
): Promise<{ layout: Layout; available: boolean; price: number; reason?: string }[]>

export async function getActivePriceForLayout(
  layoutId: string,
  windowId: string | null,
  tierId: string | null,
): Promise<{ price: number; price_type: string; source: string }>

export async function applyDiscountRules(
  bookableId: string,
  lineItems: BookingLineItem[]
): Promise<DiscountLineItem[]>
```

---

## Complete Hall setup checklist

Run through this to configure the Hall scenario end to end:

1. **Create Hall** bookable (type=VENUE)
2. **Create Basketball Court 1, 2, 3** as sub-venues (parent_id=Hall)
3. **On each court**, create layouts:
   - Full Court (fraction=1.0, granularity=FULL)
   - Half Court (fraction=0.5, granularity=HALF)
   - Third Court (fraction=0.333, granularity=THIRD)
4. **Create pricing tiers** on each court: Senior ($10), Junior ($20)
5. **Set layout prices**: Full=$X, Half=$Y, Third=$Z per tier
6. **Create tier restriction** on Junior tier: ALLOWED 15:00–19:00 all days
7. **On Hall**, create layout: Entire Venue (fraction=1.0) → all tiers $100 FIXED
8. **Create booking windows** on each court:
   - SLOTTED window: Tuesday 18:00–22:00, slot=60 min (basketball)
   - OPEN window: every day 22:00–23:59 (late night)
9. **Set window-layout prices** on late-night window: Full=$30/hr, Half=$18/hr, Third=$12/hr
10. **Create discount rule** on Hall: 20% off, min_items=2, granularity=FULL
11. **On Hall**, create booking windows:
    - OPEN window: every day 00:00–23:59 (general hire — availability blocks when courts are active)

---

## Database schema reference (relevant tables)

```
bookables                    — venues and sub-venues
bookable_layouts             — layout configs per bookable (+ capacity_fraction, granularity)
bookable_layout_tiers        — per-layout per-tier base pricing
bookable_layout_modes        — mode configs per layout (players, pricing)
booking_windows              — time windows (OPEN/SLOTTED/FIXED)
booking_window_tiers         — per-window per-tier pricing
booking_window_slots         — fixed slots within a FIXED window
booking_window_layout_prices — per-window per-layout pricing override (migration 034)
pricing_tiers                — who can book (Senior, Junior, Public…)
pricing_tier_restrictions    — time-of-day restrictions per tier (migration 032)
pricing_rules                — org-wide fallback rules (priority-based)
booking_discount_rules       — automatic quantity/condition discounts (migration 033)
bookings                     — confirmed bookings (layout_id FK added in 034)
booking_quotes               — quote/draft stage
booking_quote_items          — line items (VENUE, ADDON, DISCOUNT, SURCHARGE, TAX)
```
