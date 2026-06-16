# Appendix — Exhaustive Function Inventory (Rebuild Checklist)

> Every action-bearing file in the legacy app (`/old`, 1,052 `.php`) as a Title · Description · Status checklist — nothing omitted.
> **Layers:** Screen = `pages/` · Write = `post/` · Read = `get/` · Report = `reports/` · Job = `crons/` · Embed = `embed/` · API/Mobile = `api/`+`app/` · Pay = `payments/` · Alert = `alerts/`.
> **Status:** ✅ built in fm-events · 🟡 partial · 🔴 not started.

## Appendix A — Screens (`pages/`, 365)

### A1 · People / CRM
| Title | Description | Status |
|---|---|---|
| People directory | Member list (filters, configurable columns, presets) | 🟡 |
| Person profile | Profile w/ 8 tabs (membership/fees/awards/attendance…) | 🟡 |
| Person (user view) | End-user self-profile | 🔴 |
| Person system fields | Login / access / system fields | 🔴 |
| People (NSO) | NSO-shared directory | 🔴 |
| Person access | Per-person system access / roles | 🔴 |
| Duplicates | Duplicate-name detect & merge | 🔴 |
| People archive | Archived people | 🔴 |
| Join-date report | Membership length report | 🔴 |
| Sporty errors | NSO sync error list | 🔴 |

### A2 · Squads / Groups + Terms
| Title | Description | Status |
|---|---|---|
| Squads list | Squads by weekday (head/members/waitlist) | 🟡 |
| Squad detail | Members + class schedule + generate attendance | 🟡 |
| Codes | Squad code templates | 🔴 |
| Terms | Terms (signup open/close + priority pre-open) | 🔴 |
| Term transfer | Bulk member roll-over | 🔴 |
| Waitlist | Squad waitlists | 🔴 |
| Allocator | Bulk assign members to squads | 🔴 |
| Announcement | Message a squad | 🔴 |
| Squad reports | Members / Retention / Spaces / Subscriptions / Vaccine | 🔴 |
| Squads archive | Archived squads | 🔴 |

### A3 · Fees / Billing
| Title | Description | Status |
|---|---|---|
| Fees ledger | Invoices / outstanding | 🔴 |
| Term fees | Fee templates per term×squad | 🔴 |
| Transactions | Payments | 🔴 |
| Subscriptions | Recurring memberships | 🔴 |
| Xero config/errors/rules/sync | Accounting integration | 🔴 |
| Finance reports | Fees/Deferred/NoFees/Outstanding/Overdue/Payouts/Recurring | 🔴 |

### A4 · Events
| Title | Description | Status |
|---|---|---|
| Events list | Event list / list view | 🟡 |
| Calendar | Month/week/list + categories | 🟡 |
| Event detail | Attendees/RSVP/customise-invitation/attendance | ✅ |
| Event report | Event reporting | ✅ |

### A5 · Attendance
| Title | Description | Status |
|---|---|---|
| Attendance roll | Roll-call list + attendee records | 🟡 |
| Generate | Build sheets from squad class-times | 🔴 |
| Recurring | Mark whole term present | 🔴 |
| Vaccine passes | Vaccine-pass roll | 🔴 |
| Attendance reports | Hours (coach)/Non-attendance/Trialist/Visitors/Awards | 🔴 |

### A6 · Communications (Mailer)
| Title | Description | Status |
|---|---|---|
| Mailer | Bulk email composer (setup→content→send) | 🟡 |
| History | Sent email history | 🔴 |
| Recipients | Recipient selection (squads/custom/subscribers) | 🔴 |

### A7 · Awards
| Title | Description | Status |
|---|---|---|
| Awards | Definitions + groups (sequential/parallel) | 🔴 |
| Award reports | Award/Breakdown/CFQuarterly/CoachForce/GroupCompletion/NZC/Progression/Sequences | 🔴 |

### A8–A11 · Resources / Uniforms / Programmes / Venues
| Title | Description | Status |
|---|---|---|
| Resources | Document library + categories + detail | 🔴 |
| Uniforms/Assets | Inventory + options + stock + public view | 🔴 |
| Programmes | Holiday programmes list/detail + report | 🔴 |
| Programme booking | Wizard (dates→discounts→terms→summary→finish) | 🔴 |
| Venues | Venues + staff (private lessons) + sub-venues | 🟡 |
| Venue booking | Time-slot booking flow | 🟡 |

### A12 · Competitions (entirely net-new)
| Title | Description | Status |
|---|---|---|
| Competitions list | All competitions | 🔴 |
| Divisions | Age/gender/level brackets | 🔴 |
| Draws | Draw view + builder | 🔴 |
| Rounds | Rounds/stages | 🔴 |
| Game scheduler | Schedule games | 🔴 |
| Game events | Events within a game | 🔴 |
| Official scheduler | Assign umpires/officials | 🔴 |
| Playoff builder | Finals/playoff bracket | 🔴 |
| Starting line-up | Team line-up | 🔴 |
| Score entry | Scores + resolve + auto points | 🔴 |
| Approvals | Team/registration approvals | 🔴 |
| Publish session | Publish individual-comp session | 🔴 |
| Comp archive | Archived comps | 🔴 |
| Competition reports (16) | Attendance/Conflicts/Games/Medical/Missing*/NetballNZ/NoFees/Outstanding/Players/Roles/Teams/Umpire/Unallocated/Waivers | 🔴 |

### A13 · Registration (public signup)
| Title | Description | Status |
|---|---|---|
| Register wizard | main/choose/pre/directory/restricted/overdue/summary/finish/closed | 🟡 |
| Comp register | main/choose/summary/finish/closed | 🔴 |

### A14 · Settings / Club config
| Title | Description | Status |
|---|---|---|
| Club info / Main settings | Club info + main settings | 🟡 |
| Terminology | Rename nouns (player/member…) | 🔴 |
| Registration/Signup | Forms + embeds config | 🟡 |
| Finance | Payment config | 🔴 |
| Emails | Email templates | 🔴 |
| Sponsors / Vouchers | Sponsors + voucher codes | 🔴 |
| Integrations | Xero/Kamar/NSO | 🔴 |
| Custom fields | Field definitions | 🔴 |
| FM root | Super-admin | 🔴 |
| Xero query / Audit log | Xero query + audit | 🔴 |

### A15–A16 · Dashboards, compliance & system
| Title | Description | Status |
|---|---|---|
| Admin dashboard | KPIs/finance/upcoming/alerts | 🟡 |
| User home | End-user home | 🔴 |
| Mobile screens | mobile/notifications/reports/users | 🔴 |
| Waivers | Digital waiver signing + medical access | 🔴 |
| Vaccine pass / Police vetting | Compliance | 🔴 |
| Help & support tickets | Help/features/topic/tickets | 🔴 |
| Tracker / Website builder | Live tracking + website CMS | 🔴 |
| GNZ module | Gymnastics-NZ NSO (casual/sports/levels/transfer) | 🔴 |
| NSO connect | Connect club to NSO | 🔴 |
| Clubs / FM invoices | FM tenant mgmt + FM billing | 🔴 |

## Appendix B — Write actions (`post/`, 104)
| Title | Description | Status |
|---|---|---|
| login / forgot / reset / set-password | Auth + password reset/set | 🟡 |
| signup | Public registration → Person+PersonGroup+Fee | 🟡 |
| subscribe / unsubscribe | Newsletter opt in/out | 🔴 |
| verify-voucher / waiver-claim-player / vaccine-scan | Voucher, waiver claim, QR vaccine scan | 🔴 |
| game-availability / score-entry / session-score / compregister | Competition writes | 🔴 |
| stripe / stripe-auth / windcave / ezidebit / xero-auth | Payment gateway callbacks + OAuth | 🔴 |
| admin: add-club, club-action, settings, field, forms, term, fm-terms, codes, code-managers, groups, venue, venue-time, asset, asset-option, sponsor, voucher | Core entity create/update | 🟡 |
| admin: email-logins, email-missing-people, email-missing-individuals, email-unallocated-list, delete | Bulk emails + generic delete | 🔴 |
| admin: comp-admin, comp-import, comp-roles, session-admin, session-import-scores | Competition setup/import | 🔴 |
| admin: waiver-reminder, gateway-disconnect, xero-disconnect, gnz, gnz-casual, gnz-transfer, nzf | Reminders + integrations | 🔴 |
| fadmin: fee, term-fee, transaction, refund, discounts, program, access, support-ticket, xero-config, xero-sync | Billing writes + Xero | 🔴 |
| manager: group, event, award, awards, asset-assign, resources, coachforce, nzc-incomplete, police-verify | Group/event/award/asset writes | 🟡 |
| manager: email, email-fees, email-groups, email-statements, email-template | Mailer writes | 🔴 |
| basic: attendance, competition, session, manage-person, vaccine-pass | Roll/comp/session/person | 🟡 |
| coord: columns, event-categories, nso-connect | Columns, categories, NSO link | 🔴 |
| user: person, person-actions, event-actions, award-create, comp-user, comp-bulkregister, compclub-import, program-book | Self-service writes | 🔴 |
| user: dd-schedule, dd-cancel, valid-email, view-club, report-ssnz, bracken | Direct-debit, email, integrations | 🔴 |
| venue-book | Book a venue time slot | 🟡 |
| _root: club, fmweb, impersonate, switchrole, sparkpost | FM tenant admin, impersonate, role switch | 🔴 |

## Appendix C — Read / data endpoints (`get/`, 170)
| Title | Description | Status |
|---|---|---|
| events, custom-values, venue-available, verify-email, pay-fee, signup-groups/-assets/-vaccine | Calendar JSON, field options, availability, fee pay, signup data | 🟡 |
| comp-clubs, comp-draw, comp-team-games, comp-team-duplicates, comp-template, comp-club-embed-list | Competition data feeds | 🔴 |
| admin: groups, add-club, clubs, member-totals, code-managers, regform, regtab, regform-terms | Admin data + form builder | 🟡 |
| admin: email-edit, email-logins, email-missing-*, email-unallocated-list, venue-link, resource-category, transaction-fees, xero-overdue, award-certificate, program-new, program-sessions, fm-terms | Admin data/forms | 🔴 |
| admin: report-clubregister, report-compregistersheets, report-promotions | Print/report sheets | 🔴 |
| admin: comp-archive, comp-copy, comp-email-settings, comp-game-events, comp-manageteam, compteam-link-club | Comp admin data | 🔴 |
| fadmin: fees, fee-people, fee-recur, finance-data, fm-invoice, transaction(s), term-fees, term-fee-add/-apply, discounts, refund | Finance data | 🔴 |
| fadmin: payouts-ezidebit/-stripe, program(+book/available-dates/delete-attendee), tickets, ticket-attachment, xero-accounts | Payouts, programmes, tickets, Xero | 🔴 |
| fadmin: access, access-person, access-search, access-outputs | Access-control data | 🔴 |
| manager: events-list, event-attendees, event-search | Event data | 🟡 |
| manager: group-add-person/-search, group-allocation, group-transfer, group-awards, group-module, attendance-recurring | Group/attendance data | 🔴 |
| manager: award-assign, awards-assign, awards, award-promote, asset-assign(+variants), contact, tags, staff-positions, person-match, recipient-options, venues | Awards/assets/people data | 🔴 |
| manager: police, police-verify, comp-conflicts | Police + comp conflicts | 🔴 |
| manager: email-history/-info/-dkim/-fees/-groups/-recipients/-statement/-template, help-search, help-topics | Mailer + help data | 🔴 |
| user: person-fees, person-attendance, credits, invoice, statement, dd-details, report, resource, certificate, print-awards, award-create, email-view, waiver-lookup | Self-service data | 🔴 |
| user: comp-* (add-person/participant/teams, join-comp, search, edit-person, registrations, waivers, certificates, game/session schedule/results), compclub-import-people | Competition self-service | 🔴 |
| basic: comps, comp-active-games, comp-add-round/-score/-umpire, comp-approve-team, comp-check-racenums, comp-club-list, comp-drawprint, comp-edit-game, comp-generate, comp-move-team, comp-officials-list/-schedule, comp-playoff, comp-scoreprint, comp-sessionprint, comp-shirts, comp-team-list | Competition operations | 🔴 |
| basic: attendance, attendance-report, search, export | Attendance, search, export | 🟡 |
| coord: people, people-export, medical, programs, event-categories, embeds, report-joindate | Coordinator data | 🔴 |
| _root: audit-log, xero-query, sparkpost | Audit, Xero query, email events | 🔴 |

## Appendix D — Reports engine (`reports/`, 41)
| Title | Description | Status |
|---|---|---|
| people / people-new / membership / retention / allocations / waitlist / groups | Member & squad reports | 🔴 |
| attendance-trialist / event / awards / awardgroup-completion / archive / asset-report / police / vaccine-report | Activity & compliance reports | 🔴 |
| cf-quarterly / gnz-levels / gnz-missing / program | NSO & programme reports | 🔴 |
| fees / outstanding-fees / overdue-fees / recurring-fees / transactions | Finance reports | 🔴 |
| comp-* (17: club-people/draws/games/medical-access/missing-*/netballnz/outstanding/overall/players/roles/school-invoices/teams/umpires/unallocated/waivers) + umpire-requirements | Competition reports | 🔴 |

## Appendix E — Scheduled jobs (`crons/`, 21)
| Title | Description | Status |
|---|---|---|
| driver | Cron orchestrator | 🔴 |
| recur | Create recurring fees | 🔴 |
| promptpayments | Reverse early-payment discounts if unpaid | 🔴 |
| subscriptions | Expire subscription memberships | 🔴 |
| registrations | Signup reminder emails | 🔴 |
| statements | Monthly invoices/statements | 🔴 |
| checkattendance / cleanup / stats / online | Maintenance & aggregation | 🔴 |
| xero / ezidebit | Accounting + direct-debit sync | 🔴 |
| gamescore | Aggregate competition scores | 🔴 |
| bracken / comet / elitesx / gnz-servicebus / gnz-transfers / nzf-cometimport / nzf-sportydata / nzf-vaxemail | NSO/integration syncs | 🔴 |

## Appendix F — Public embeds (`embed/`, 11)
| Title | Description | Status |
|---|---|---|
| calendar / register / book / programs / assets | Embeddable calendar, signup, booking, programmes, shop | 🔴 |
| compregister / draws / overallplacings / publishsession | Competition embeds | 🔴 |
| clublist / waiver | NSO club list + waiver embed | 🔴 |

## Appendix G — API & mobile
| Title | Description | Status |
|---|---|---|
| api/v1 | REST v1 (people/groups/events/fees, bearer token) | 🔴 |
| api/system | System setup (system-key) | 🔴 |
| app/attendance | Mobile scan/lookup attendance | 🔴 |
| app/gamefeed | Mobile live game feed | 🔴 |
| app/scores | Mobile submit scores | 🔴 |

## Appendix H — Payment gateways (`payments/`, 9)
| Title | Description | Status |
|---|---|---|
| ezidebit (pay-fee/payment/transaction) | Direct-debit charge/process/settle | 🔴 |
| stripe (pay-fee/payment/transaction) | Card charge/process/settle | 🔴 |
| windcave (pay-fee/payment/transaction) | NZ gateway charge/process/settle | 🔴 |

## Appendix I — Automated alerts (`alerts/`, 9)
| Title | Description | Status |
|---|---|---|
| signup-open | Term signup opened | 🔴 |
| program-open | Programme bookings open | 🔴 |
| term-end | Term ending | 🔴 |
| transfer / gnz-transfer | Member transfer alerts | 🔴 |
| comp-emails | Competition notices | 🔴 |
| emails | Generic email queue | 🔴 |
| xero | Xero error alert | 🔴 |
| fm | FM system alerts | 🔴 |

> **Not separately tabled** (scaffolding behind the above): `classes/` (148 domain models — business rules in `PLATFORM_AUDIT.md` Part 2), `email/` (61 templates), `pdf/` (53 PDF templates), `inc/` (29 includes), `switch.php` routers.
