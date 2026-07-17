# API reference

The re-plumbed seam — every endpoint the client talks to, in place of direct DB
access. Generated from the route files; 116 endpoints across 38 groups.

All are versioned under `/api/v1`. List endpoints take `?orgId=` (or a parent id);
writes validate the request body against the domain's create/patch contract and
return the entity validated against its read contract.

## activities

| Method | Path |
|---|---|
| GET | `/api/v1/activities` |
| POST | `/api/v1/activities` |
| DELETE | `/api/v1/activities/:id` |
| PATCH | `/api/v1/activities/:id` |

## bookables

| Method | Path |
|---|---|
| GET | `/api/v1/bookables` |
| POST | `/api/v1/bookables` |
| DELETE | `/api/v1/bookables/:id` |
| PATCH | `/api/v1/bookables/:id` |

## booking-discounts

| Method | Path |
|---|---|
| GET | `/api/v1/booking-discounts` |

## bookings

| Method | Path |
|---|---|
| GET | `/api/v1/bookings` |

## brands

| Method | Path |
|---|---|
| GET | `/api/v1/brands` |

## calendars

| Method | Path |
|---|---|
| GET | `/api/v1/calendars` |

## circles

| Method | Path |
|---|---|
| GET | `/api/v1/circles` |

## club-types

| Method | Path |
|---|---|
| GET | `/api/v1/club-types` |

## code-staff

| Method | Path |
|---|---|
| GET | `/api/v1/code-staff` |

## communications

| Method | Path |
|---|---|
| GET | `/api/v1/communications` |

## disciplines

| Method | Path |
|---|---|
| GET | `/api/v1/disciplines` |
| POST | `/api/v1/disciplines` |
| DELETE | `/api/v1/disciplines/:id` |
| PATCH | `/api/v1/disciplines/:id` |
| POST | `/api/v1/disciplines/:id/requirements` |
| GET | `/api/v1/disciplines/requirements` |

## discounts

| Method | Path |
|---|---|
| GET | `/api/v1/discounts` |
| POST | `/api/v1/discounts` |
| DELETE | `/api/v1/discounts/:id` |
| PATCH | `/api/v1/discounts/:id` |

## entities

| Method | Path |
|---|---|
| GET | `/api/v1/entities` |
| POST | `/api/v1/entities` |
| DELETE | `/api/v1/entities/:id` |
| PATCH | `/api/v1/entities/:id` |

## events

| Method | Path |
|---|---|
| GET | `/api/v1/events` |
| POST | `/api/v1/events` |
| DELETE | `/api/v1/events/:id` |
| GET | `/api/v1/events/:id` |
| PATCH | `/api/v1/events/:id` |
| GET | `/api/v1/events/:id/invitees` |
| GET | `/api/v1/events/:id/registrations` |
| GET | `/api/v1/events/:id/sessions` |
| POST | `/api/v1/events/:id/sessions` |

## field-definitions

| Method | Path |
|---|---|
| GET | `/api/v1/field-definitions` |
| POST | `/api/v1/field-definitions` |
| DELETE | `/api/v1/field-definitions/:id` |
| PATCH | `/api/v1/field-definitions/:id` |

## form-submissions

| Method | Path |
|---|---|
| GET | `/api/v1/form-submissions` |

## forms

| Method | Path |
|---|---|
| GET | `/api/v1/forms` |
| POST | `/api/v1/forms` |
| DELETE | `/api/v1/forms/:id` |
| GET | `/api/v1/forms/:id` |
| PATCH | `/api/v1/forms/:id` |
| GET | `/api/v1/forms/:id/targets` |

## group-codes

| Method | Path |
|---|---|
| GET | `/api/v1/group-codes` |
| POST | `/api/v1/group-codes` |
| DELETE | `/api/v1/group-codes/:id` |
| PATCH | `/api/v1/group-codes/:id` |

## groups

| Method | Path |
|---|---|
| GET | `/api/v1/groups` |
| POST | `/api/v1/groups` |
| DELETE | `/api/v1/groups/:id` |
| GET | `/api/v1/groups/:id` |
| PATCH | `/api/v1/groups/:id` |
| GET | `/api/v1/groups/:id/fee-options` |
| GET | `/api/v1/groups/:id/memberships` |
| GET | `/api/v1/groups/:id/schedules` |

## help-articles

| Method | Path |
|---|---|
| GET | `/api/v1/help-articles` |

## locations

| Method | Path |
|---|---|
| GET | `/api/v1/locations` |
| POST | `/api/v1/locations` |
| DELETE | `/api/v1/locations/:id` |
| PATCH | `/api/v1/locations/:id` |

## managers

| Method | Path |
|---|---|
| GET | `/api/v1/managers` |

## memberships

| Method | Path |
|---|---|
| GET | `/api/v1/memberships/entitlements` |
| GET | `/api/v1/memberships/plans` |
| POST | `/api/v1/memberships/plans` |
| DELETE | `/api/v1/memberships/plans/:id` |
| PATCH | `/api/v1/memberships/plans/:id` |

## org-sports

| Method | Path |
|---|---|
| GET | `/api/v1/org-sports` |
| POST | `/api/v1/org-sports` |
| DELETE | `/api/v1/org-sports/:id` |
| PATCH | `/api/v1/org-sports/:id` |

## organisations

| Method | Path |
|---|---|
| GET | `/api/v1/organisations` |
| POST | `/api/v1/organisations` |
| DELETE | `/api/v1/organisations/:id` |
| PATCH | `/api/v1/organisations/:id` |
| GET | `/api/v1/organisations/:id/ancestors` |
| GET | `/api/v1/organisations/:id/descendants` |

## people

| Method | Path |
|---|---|
| GET | `/api/v1/people` |
| POST | `/api/v1/people` |
| DELETE | `/api/v1/people/:id` |
| GET | `/api/v1/people/:id` |
| PATCH | `/api/v1/people/:id` |

## permission-groups

| Method | Path |
|---|---|
| GET | `/api/v1/permission-groups` |

## person-notes

| Method | Path |
|---|---|
| GET | `/api/v1/person-notes` |

## person-type-links

| Method | Path |
|---|---|
| GET | `/api/v1/person-type-links` |

## person-types

| Method | Path |
|---|---|
| GET | `/api/v1/person-types` |
| POST | `/api/v1/person-types` |
| DELETE | `/api/v1/person-types/:id` |
| PATCH | `/api/v1/person-types/:id` |

## resource-folders

| Method | Path |
|---|---|
| GET | `/api/v1/resource-folders` |

## resources

| Method | Path |
|---|---|
| GET | `/api/v1/resources` |
| POST | `/api/v1/resources` |
| DELETE | `/api/v1/resources/:id` |
| PATCH | `/api/v1/resources/:id` |

## scoped-roles

| Method | Path |
|---|---|
| GET | `/api/v1/scoped-roles` |
| POST | `/api/v1/scoped-roles` |
| DELETE | `/api/v1/scoped-roles/:id` |
| PATCH | `/api/v1/scoped-roles/:id` |

## sessions

| Method | Path |
|---|---|
| DELETE | `/api/v1/sessions/:id` |
| PATCH | `/api/v1/sessions/:id` |

## term-sets

| Method | Path |
|---|---|
| GET | `/api/v1/term-sets` |

## terms

| Method | Path |
|---|---|
| GET | `/api/v1/terms` |
| POST | `/api/v1/terms` |
| DELETE | `/api/v1/terms/:id` |
| PATCH | `/api/v1/terms/:id` |

## waitlists

| Method | Path |
|---|---|
| GET | `/api/v1/waitlists` |
| POST | `/api/v1/waitlists` |
| DELETE | `/api/v1/waitlists/:id` |
| PATCH | `/api/v1/waitlists/:id` |

## xero-connection

| Method | Path |
|---|---|
| GET | `/api/v1/xero-connection` |
