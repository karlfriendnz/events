<?php
namespace Api;

/**
 * Integration endpoint for the FM Events module.
 *
 * The events module runs as its own application and holds its own event model
 * (sessions, recurrence, registration forms, ticket types, discounts). This
 * endpoint is the only thing it talks to. It does two jobs:
 *
 *   READ   club data the module needs — people, classes, terms, venues,
 *          categories, custom fields. Never copied, always read through.
 *   WRITE  the things the club already runs its business on — a flat Event row
 *          so the existing calendar keeps working, EventPerson for attendance,
 *          and Fee for money.
 *
 * Writes use the existing models and conventions (Event::addGroup, the
 * assocType 'Event' fee convention Event::applyFee and EventPerson::fee()
 * already use), so the rows are indistinguishable from ones the platform made
 * itself. Where a model method omits NOT NULL columns that only default under
 * non-strict MySQL, this fills them explicitly — see postAttendance and postFee.
 *
 * Routing: /api/v1/fmevents/{method}. A GET maps to get{Method}, a POST to
 * post{Method} (see Api::route). Reads take query params, writes take a JSON
 * body. Auth is the standard per-club Authorization: token <key>.
 *
 * NB Api::route() resolves the URL segment with method_exists(), which ignores
 * visibility — so every private helper here is reachable as an endpoint too.
 * Keep helper names distinct from the public ones (that is why the person
 * lookup is requirePerson, not person).
 *
 * Calls are server-to-server from the events module, never from a browser, so
 * the API key never reaches a client and CORS does not apply.
 */
class fmevents extends \ApiEndpoint {

    /** Settings safe to expose. Never dump the whole table — it holds secrets. */
    const PUBLIC_SETTINGS = [
        'classtimes', 'fees-combine', 'module-assets', 'module-merchandise',
        'module-program', 'module-resources', 'module-venues',
    ];

    // ── helpers ───────────────────────────────────────────────────────────

    /**
     * The JSON request body. Api::respond only binds query params, so writes
     * read their own body — the same approach api/system.php already uses.
     */
    private function body(): array {
        static $body;
        if ($body === null) {
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
        }
        return $body;
    }

    private function need(string $key) {
        $body = $this->body();
        if (!isset($body[$key])) throw new \ApiException("Missing '$key' in request body", 422);
        return $body[$key];
    }

    private function opt(string $key, $default=null) {
        return $this->body()[$key] ?? $default;
    }

    /** Resolve a person id from the body, erroring clearly if it isn't real. */
    private function requirePerson($id): \Person {
        $person = $id ? $this->_db->Person($id) : null;
        if (!$person || $person->status < 1) throw new \ApiException("Person $id not found", 422);
        return $person;
    }

    // ── 1. identity ───────────────────────────────────────────────────────

    /**
     * Exchange a single-use login token for the person behind it.
     *
     * The old platform mints the token when it renders the events iframe:
     *   $person->generateAuthToken('app', 300)
     * which is the mechanism ClubDB::main() already honours for ?logintoken=.
     * validateAuthToken consumes the token, so it works exactly once.
     */
    public function getWhoami(string $logintoken): array {
        $person = $this->_db->Person->validateAuthToken($logintoken, 'app');
        if (!$person) throw new \ApiException('Invalid or expired login token', 401);

        return [
            'person' => [
                'id'        => $person->id,
                'firstName' => $person->firstName,
                'lastName'  => $person->lastName,
                'email'     => $person->email,
                'role'      => (int)$person->role,
                'roleName'  => \Person::ROLES[$person->role] ?? null,
            ],
            'club' => $this->clubInfo(),
        ];
    }

    // ── 2. club reference data ────────────────────────────────────────────

    private function clubInfo(): array {
        $settings = [];
        foreach (self::PUBLIC_SETTINGS as $key) {
            $settings[$key] = $this->_db->setting($key);
        }
        return [
            'id'       => $this->_db->info('id'),
            'name'     => $this->_db->info('name'),
            // Dates and times in this platform are stored as WALL CLOCK with no
            // zone, so anything reading them has to know which zone that is —
            // otherwise a server in UTC reads a 1pm booking as 1pm UTC.
            'timezone' => $this->_db->info('timezone') ?: 'UTC',
            'settings' => $settings,
        ];
    }

    public function getClub(): array {
        return $this->clubInfo();
    }

    /**
     * The club's own event categories — what the category picker offers.
     *
     * Uses allCustom(), not all(): rows with an eventType are the platform's
     * SYSTEM categories (name NULL, one per event type, supplying that type's
     * default colour), not things a club picks from.
     */
    public function getCategories(): array {
        $data = [];
        foreach ($this->_db->EventCategory->allCustom() as $cat) {
            $data[] = [
                'id'        => $cat->id,
                'name'      => $cat->name,
                'colour'    => $cat->colour,
                'eventType' => $cat->eventType === null ? null : (int)$cat->eventType,
                'selected'  => (bool)$cat->selected,
            ];
        }
        return $data;
    }

    /** Venues, flat with parentID so the module can rebuild the tree. */
    public function getVenues(): array {
        $data = [];
        foreach ($this->_db->Venue->find() as $venue) {
            $data[] = [
                'id'          => $venue->id,
                'name'        => $venue->name,
                'location'    => $venue->location,
                'description' => $venue->description,
                'parentID'    => $venue->parentID ? (int)$venue->parentID : null,
                'order'       => (int)$venue->order,
            ];
        }
        return $data;
    }

    /** Terms, including the sign-up window the term owns. */
    public function getTerms(): array {
        $data = [];
        foreach ($this->_db->Term->find() as $term) {
            $data[] = [
                'id'               => $term->id,
                'name'             => $term->name,
                'start'            => $term->start,
                'end'              => $term->end,
                'signupOpenDate'   => $term->signupOpenDate,
                'signupCloseDate'  => $term->signupCloseDate,
                'termset'          => (int)$term->termset,
            ];
        }
        return $data;
    }

    /** Code tree — the programmes classes hang off. */
    public function getCodes(): array {
        $data = [];
        foreach ($this->_db->Code->find() as $code) {
            $data[] = [
                'id'       => $code->id,
                'name'     => $code->name,
                'parentID' => $code->parentID ? (int)$code->parentID : null,
                'termset'  => (int)$code->termset,
                'publish'  => (bool)$code->publish,
                'order'    => (int)$code->order,
            ];
        }
        return $data;
    }

    /** Classes. Used to link an event to a class, and later to invite one. */
    public function getGroups(): array {
        $data = [];
        foreach ($this->_db->Group->find() as $group) {
            $data[] = [
                'id'          => $group->id,
                'name'        => $group->name,
                'codeID'      => $group->codeID ? (int)$group->codeID : null,
                'headID'      => $group->headID ? (int)$group->headID : null,
                'limit'       => $group->limit !== null ? (int)$group->limit : null,
                'startAge'    => $group->startAge !== null ? (int)$group->startAge : null,
                'endAge'      => $group->endAge !== null ? (int)$group->endAge : null,
                'gender'      => $group->gender,
                'public'      => (bool)$group->public,
                'shortCode'   => $group->shortCode,
                'description' => $group->description,
            ];
        }
        return $data;
    }

    /**
     * Who is in a class. This is what the invitee selector needs — getGroups
     * gives it the list of classes, this gives it the people inside one.
     *
     * PersonGroup is keyed (person, group, term, staff), so the roster is
     * per-term and separates staff from members. Omit termID for every term.
     */
    public function getRoster(int $groupID, ?int $termID=null): array {
        $where = "JOIN PersonGroup pg ON pg.personID = Person.id AND pg.groupID = ?";
        $params = [$groupID];
        if ($termID !== null) {
            $where .= " AND pg.termID = ?";
            $params[] = $termID;
        }
        $where .= " WHERE Person.status > 0 ORDER BY Person.lastName, Person.firstName";

        $roles = $this->_db->execute(
            "SELECT personID, MAX(staff) AS staff, GROUP_CONCAT(DISTINCT position) AS positions
             FROM PersonGroup WHERE groupID = ?".($termID !== null ? " AND termID = ?" : "")." GROUP BY personID",
            ...$params
        )->fetchAll(\PDO::FETCH_UNIQUE|\PDO::FETCH_ASSOC);

        $data = [];
        foreach ($this->_db->Person->select($where, ...$params) as $person) {
            $data[] = $this->personSummary($person) + [
                'staff'     => (bool)($roles[$person->id]['staff'] ?? false),
                'positions' => array_filter(explode(',', $roles[$person->id]['positions'] ?? '')),
            ];
        }
        return $data;
    }

    /**
     * Holiday programmes. In this platform a programme is a Program row plus
     * one Event per day carrying programID (and normally type 6, TYPE_PROGRAM);
     * EventPerson::fee() charges those against the PROGRAMME, not the day, so a
     * family is billed once for the week rather than once per morning.
     */
    public function getPrograms(): array {
        $data = [];
        foreach ($this->_db->Program->find() as $program) {
            $data[] = [
                'id'       => $program->id,
                'name'     => $program->name,
                'open'     => $program->open,
                'close'    => $program->close,
                'cost'     => (float)$program->cost,
                'dayCost'  => (float)$program->dayCost,
                'feeDue'   => $program->feeDue,
                'startAge' => (int)$program->startAge,
                'endAge'   => (int)$program->endAge,
                'account'  => $program->account,
            ];
        }
        return $data;
    }

    public function postProgram(): array {
        $props = [];
        foreach (['name', 'open', 'close', 'cost', 'dayCost', 'feeDue', 'startAge', 'endAge', 'account'] as $field) {
            $value = $this->opt($field);
            if ($value !== null) $props[$field] = $value;
        }

        $programID = $this->opt('programID');
        if ($programID) {
            $program = $this->_db->Program($programID);
            if (!$program || $program->status < 1) throw new \ApiException("Program $programID not found", 422);
            if ($props) $program->update($props);
            return ['programID'=>$program->id, 'created'=>false];
        }

        if (empty($props['name'])) throw new \ApiException('name is required to create a programme', 422);
        $program = $this->_db->Program->create($props + [
            'open'     => $props['open']  ?? date('Y-m-d'),
            'close'    => $props['close'] ?? date('Y-m-d'),
            'cost'     => 0,
            'dayCost'  => 0,
            'feeDue'   => $props['close'] ?? date('Y-m-d'),
            'startAge' => 0,
            'endAge'   => 0,
        ]);
        return ['programID'=>$program->id, 'created'=>true];
    }

    /**
     * The club's own custom person fields, with their dropdown options. This is
     * what lets the events form designer offer the club's real fields instead of
     * inventing a parallel set that never reaches the member's profile.
     */
    public function getCustomFields(string $assocType='Person'): array {
        $data = [];
        foreach ($this->_db->CustomField->find(['assocType'=>$assocType]) as $field) {
            // CustomSelectValue has no model class, so $db->CustomSelectValue is
            // null — read it directly.
            $options = $this->_db->execute(
                "SELECT id, value, parentID FROM CustomSelectValue WHERE customFieldID = ? ORDER BY `order`",
                $field->id
            )->fetchAll(\PDO::FETCH_ASSOC);
            $data[] = [
                'field'       => $field->field,
                'name'        => $field->name,
                'type'        => $field->type,
                'values'      => $field->values,
                'options'     => $options,
                'codeID'      => $field->codeID ? (int)$field->codeID : null,
                'description' => $field->description,
                'access'      => (int)$field->access,
            ];
        }
        return $data;
    }

    // ── 3. people ─────────────────────────────────────────────────────────

    /** Person search. Paginated — some clubs have five figures of members. */
    public function getPeople(string $q='', int $limit=50, int $offset=0): array {
        $limit = max(1, min(200, $limit));
        $where = "WHERE status > 0";
        $params = [];
        if ($q !== '') {
            $like = '%'.$q.'%';
            $where .= " AND (CONCAT(firstName, ' ', lastName) LIKE ? OR email LIKE ? OR phone LIKE ?)";
            $params = [$like, $like, $like];
        }
        $people = $this->_db->Person->select("$where ORDER BY lastName, firstName LIMIT $limit OFFSET $offset", ...$params);
        $total = $this->_db->execute("SELECT COUNT(*) FROM Person $where", ...$params)->fetchColumn();

        $data = [];
        foreach ($people as $person) $data[] = $this->personSummary($person);
        return ['total'=>(int)$total, 'limit'=>$limit, 'offset'=>$offset, 'people'=>$data];
    }

    private function personSummary(\Person $person): array {
        return [
            'id'          => $person->id,
            'firstName'   => $person->firstName,
            'lastName'    => $person->lastName,
            'email'       => $person->email,
            'phone'       => $person->phone,
            'dateOfBirth' => $person->dateOfBirth,
            'gender'      => $person->gender,
        ];
    }

    /**
     * Match on email. Deliberately returns every match rather than picking one —
     * families share addresses and duplicates exist, and merging a registration
     * onto the wrong member is worse than asking.
     */
    public function getPersonByEmail(string $email): array {
        $data = [];
        foreach ($this->_db->Person->find(['email'=>$email]) as $person) {
            $data[] = $this->personSummary($person);
        }
        return $data;
    }

    /** One person in full, including their custom field values. */
    public function getPerson(\Person $person): array {
        $custom = $this->_db->execute(
            "SELECT field, value FROM CustomFieldPerson WHERE personID = ?", $person->id
        )->fetchAll(\PDO::FETCH_KEY_PAIR);

        return $this->personSummary($person) + [
            'street'         => $person->street,
            'suburb'         => $person->suburb,
            'city'           => $person->city,
            'postCode'       => $person->postCode,
            'country'        => $person->country,
            'alternatePhone' => $person->alternatePhone,
            'role'           => (int)$person->role,
            'primaryContact' => $person->primaryContact ? (int)$person->primaryContact : null,
            'customFields'   => $custom,
        ];
    }

    /**
     * Create or update a person from a registration.
     *
     * Takes an explicit personID to update. With no personID it always CREATES —
     * it will not silently merge onto an email match, because that is how a
     * stranger's registration ends up written over a real member. Call
     * /people/byEmail first and decide.
     *
     * New people are created with no login (role 0) unless told otherwise.
     */
    public function postPerson(): array {
        $fields = ['firstName', 'lastName', 'email', 'phone', 'alternatePhone', 'gender',
                   'dateOfBirth', 'street', 'suburb', 'city', 'postCode', 'country'];
        $props = [];
        foreach ($fields as $field) {
            $value = $this->opt($field);
            if ($value !== null) $props[$field] = $value;
        }

        $personID = $this->opt('personID');
        if ($personID) {
            $person = $this->requirePerson($personID);
            if ($props) $person->update($props);
            $created = false;
        } else {
            if (empty($props['firstName']) || empty($props['lastName'])) {
                throw new \ApiException('firstName and lastName are required to create a person', 422);
            }
            // Like Event, Person has NOT NULL columns with no defaults. The
            // zero-date values match what the platform's own rows carry for
            // "not set" (see the template club's seed row).
            $props['role'] = (int)$this->opt('role', \Person::ROLE_NONE);
            $props += [
                'gender'       => '',
                'password'     => '',
                'lastLoggedIn' => '0000-00-00 00:00:00',
                'dateOfBirth'  => '0000-00-00',
                'resignDate'   => '0000-00-00',
                'street'       => '',
                'suburb'       => '',
                'city'         => '',
                'country'      => '',
                'postCode'     => '',
                'medical'      => '',
                'notes'        => '',
                'relatedComms' => 1,
                'invalidEmail' => 0,
            ];
            $person = $this->_db->Person->create($props);
            $created = true;
        }

        // Custom field values, keyed by CustomField.field.
        foreach ((array)$this->opt('customFields', []) as $field => $value) {
            $this->_db->execute(
                "REPLACE INTO CustomFieldPerson SET field = ?, personID = ?, value = ?",
                $field, $person->id, $value
            );
        }

        return ['personID'=>$person->id, 'created'=>$created];
    }

    // ── 4. calendar ───────────────────────────────────────────────────────

    /**
     * Events in a date range — the staff-scope version of public/getEvents,
     * so the module can show what the club already has and reconcile against it.
     */
    public function getEvents(\DateTime $start, \DateTime $end): array {
        $events = $this->_db->Event->select(
            "WHERE endDate >= ? AND date < ? AND status > 0 ORDER BY date, startTime",
            $start->format('Y-m-d'), $end->format('Y-m-d')
        );
        $data = [];
        foreach ($events as $event) $data[] = $this->eventData($event);
        return $data;
    }

    public function getEvent(\Event $event): array {
        return $this->eventData($event);
    }

    /**
     * The events one person is attached to — what the profile's Events tab
     * shows. In this platform that tab is just the club calendar with
     * calData.person set, so this is getEvents() filtered to a person, plus
     * their attendance status and whether they have been charged.
     */
    public function getPersonEvents(\Person $person, ?\DateTime $start=null, ?\DateTime $end=null): array {
        $where = "JOIN EventPerson ep ON ep.eventID = Event.id AND ep.personID = ? WHERE Event.status > 0";
        $params = [$person->id];
        if ($start) { $where .= " AND Event.endDate >= ?"; $params[] = $start->format('Y-m-d'); }
        if ($end)   { $where .= " AND Event.date < ?";     $params[] = $end->format('Y-m-d'); }
        $where .= " ORDER BY Event.date DESC, Event.startTime";

        $data = [];
        foreach ($this->_db->Event->select($where, ...$params) as $event) {
            $ep = $this->_db->EventPerson->get(['eventID'=>$event->id, 'personID'=>$person->id]);
            $fee = $ep?->fee();
            $data[] = $this->eventData($event) + [
                'attendance' => [
                    'status'        => $ep ? (int)$ep->status : null,
                    'signedInTime'  => $ep?->signedInTime,
                    'signedOutTime' => $ep?->signedOutTime,
                ],
                // NB not 'fee' — eventData already uses that for the event's
                // price. This is what THIS person was charged.
                'personFee' => $fee ? ['feeID'=>$fee->id, 'amount'=>(float)$fee->amount, 'dueDate'=>$fee->dueDate] : null,
            ];
        }
        return $data;
    }

    private function safeColour(\Event $event): ?string {
        try {
            return $event->colour();
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function eventData(\Event $event): array {
        $categories = [];
        foreach ($event->categories() as $cat) $categories[] = ['id'=>$cat->id, 'name'=>$cat->name];

        return [
            'id'           => $event->id,
            'name'         => $event->name(true),
            'type'         => (int)$event->type,
            'status'       => (int)$event->status,
            'isPublic'     => (bool)($event->status & \Event::STATUS_PUBLIC),
            'date'         => $event->date,
            'startTime'    => $event->startTime,
            'endDate'      => $event->endDate,
            'endTime'      => $event->endTime,
            'allDay'       => $event->allDay(),
            // colour() resolves through the system category for the event's
            // type and throws if that row is missing (a club whose system
            // categories were never seeded, or an event left on a retired
            // type). One bad row must not take down the whole calendar.
            'colour'       => $this->safeColour($event),
            'venueID'      => $event->venueID ? (int)$event->venueID : null,
            'location'     => $event->location(),
            'notes'        => $event->notes,
            'fee'          => $event->fee !== null ? (float)$event->fee : null,
            'feeDue'       => $event->feeDue,
            'account'      => $event->account,
            'maxAttendees' => $event->maxAttendees !== null ? (int)$event->maxAttendees : null,
            'closeDate'    => $event->closeDate,
            'categoryIDs'  => array_column($categories, 'id'),
            'categories'   => $categories,
            'groupIDs'     => array_map('intval', $event->groupIDs()),
            'attending'    => $event->attending(),
        ];
    }

    /**
     * Create or update the flat Event row that represents one of the module's
     * events, so it appears on the club's existing calendar, on member
     * timelines and in reports.
     *
     * The module keeps the returned eventID against its own record and sends it
     * back on update — that is what makes this safe to retry without creating a
     * second event, so no separate idempotency store is needed.
     */
    public function postEvent(): array {
        // programID links a day to its holiday programme; awardID is the legacy
        // award an event can grant.
        $fields = ['name', 'type', 'date', 'startTime', 'endDate', 'endTime', 'venueID',
                   'location', 'notes', 'fee', 'feeDue', 'account', 'maxAttendees',
                   'closeDate', 'terms', 'personID', 'programID', 'awardID'];
        $props = [];
        foreach ($fields as $field) {
            $value = $this->opt($field);
            if ($value !== null) $props[$field] = $value;
        }

        // Visibility is a bitmask, not a flag: DEFAULT(1) | GLOBAL(2) | PUBLIC(4).
        // Only recomputed when the caller actually says something about it —
        // otherwise a partial update (say, a rename) would silently unpublish
        // the event by rebuilding the mask from absent fields.
        if ($this->opt('isPublic') !== null || $this->opt('allMembers') !== null) {
            $status = \Event::STATUS_DEFAULT;
            if ($this->opt('allMembers')) $status |= \Event::STATUS_GLOBAL;
            if ($this->opt('isPublic'))   $status |= \Event::STATUS_PUBLIC;
            $props['status'] = $status;
        }

        $eventID = $this->opt('eventID');
        if ($eventID) {
            $event = $this->_db->Event($eventID);
            if (!$event || $event->status < 1) throw new \ApiException("Event $eventID not found", 422);
            $event->update($props);
            $created = false;
        } else {
            if (empty($props['name']) || empty($props['date'])) {
                throw new \ApiException('name and date are required to create an event', 422);
            }
            // The Event table has fourteen NOT NULL columns with no defaults, so
            // a create has to supply every one of them or MySQL rejects the row.
            $props += [
                'status'        => \Event::STATUS_DEFAULT,
                'type'          => \Event::TYPE_DEFAULT,
                'location'      => '',
                'startTime'     => '00:00:00',
                'endDate'       => $props['date'],
                'endTime'       => '00:00:00',
                'fee'           => 0,
                'feeDue'        => $props['date'],
                'notes'         => '',
                'maxAttendees'  => 0,
                'closeDate'     => $props['date'],
                'terms'         => '',
                'notifications' => \Event::NOTIFY_NONE,
            ];
            $event = $this->_db->Event->create($props);
            $created = true;
        }

        // Categories and classes are replaced wholesale when supplied, left
        // alone when omitted — so a partial update never silently unlinks them.
        $categoryIDs = $this->opt('categoryIDs');
        if ($categoryIDs !== null) {
            $this->_db->execute("DELETE FROM EventCategoryLink WHERE eventID = ?", $event->id);
            foreach ((array)$categoryIDs as $id) {
                $this->_db->execute(
                    "INSERT IGNORE INTO EventCategoryLink SET eventID = ?, eventCategoryID = ?",
                    $event->id, (int)$id
                );
            }
        }

        $groupIDs = $this->opt('groupIDs');
        if ($groupIDs !== null) {
            $this->_db->execute("DELETE FROM EventGroup WHERE eventID = ?", $event->id);
            foreach ((array)$groupIDs as $id) $event->addGroup((int)$id);
        }

        return ['eventID'=>$event->id, 'created'=>$created] + $this->eventData($event);
    }

    /** Soft-delete, the way the rest of the platform does it. */
    public function postEventDelete(): array {
        $event = $this->_db->Event($this->need('eventID'));
        if (!$event) throw new \ApiException('Event not found', 422);
        $event->update(['status'=>0]);
        return ['eventID'=>$event->id, 'deleted'=>true];
    }

    // ── 5. attendance ─────────────────────────────────────────────────────

    public function getAttendance(\Event $event): array {
        $data = [];
        foreach ($event->attendees() as $ep) {
            $data[] = [
                'personID'      => $ep->personID ? (int)$ep->personID : null,
                // name() resolves the PERSON's full name; the bare `name` column
                // only holds something for guests, so reading it directly left
                // every real member showing as "Person 335".
                'name'          => $ep->name(false),
                'status'        => (int)$ep->status,
                'type'          => (int)$ep->type,
                'signedInTime'  => $ep->signedInTime,
                'signedOutTime' => $ep->signedOutTime,
                'note'          => $ep->note,
                'hours'         => $ep->hours !== null ? (float)$ep->hours : null,
            ];
        }
        return $data;
    }

    /**
     * Write the module's roll back onto EventPerson, whose statuses already
     * line up with the module's: -1 declined, 1 attended, 2 invited,
     * 3 included, 4 confirmed.
     *
     * Batched, and reports per entry — a partial failure has to be visible
     * rather than silently losing one person's attendance.
     */
    public function postAttendance(): array {
        $event = $this->_db->Event($this->need('eventID'));
        if (!$event || $event->status < 1) throw new \ApiException('Event not found', 422);

        $results = [];
        foreach ((array)$this->need('entries') as $entry) {
            try {
                $person = $this->requirePerson($entry['personID'] ?? null);
                $props = [];
                foreach (['status', 'type', 'signedInTime', 'signedOutTime', 'signedinID', 'signedoutID', 'note', 'hours'] as $field) {
                    if (isset($entry[$field])) $props[$field] = $entry[$field];
                }

                $ep = $this->_db->EventPerson->get(['eventID'=>$event->id, 'personID'=>$person->id]);
                if ($ep) {
                    if ($props) $ep->update($props);
                } else {
                    // Deliberately not Event::addAttendee(): it omits hours/name/
                    // note, which are NOT NULL without defaults. That is fine on a
                    // server running MySQL non-strict (as production does) but
                    // fails under STRICT_TRANS_TABLES. Filling them explicitly
                    // makes this work the same either way.
                    $ep = $this->_db->EventPerson->create($props + [
                        'eventID'  => $event->id,
                        'personID' => $person->id,
                        'status'   => \EventPerson::STATUS_ATTENDED,
                        'type'     => \EventPerson::TYPE_DEFAULT,
                        'hours'    => 0,
                        'name'     => '',
                        'note'     => '',
                    ]);
                }
                $results[] = ['personID'=>$person->id, 'ok'=>true];
            } catch (\Exception $e) {
                $results[] = ['personID'=>$entry['personID'] ?? null, 'ok'=>false, 'error'=>$e->getMessage()];
            }
        }
        return ['eventID'=>$event->id, 'results'=>$results];
    }

    // ── 6. money ──────────────────────────────────────────────────────────

    /** What this person has already been charged for this event, and paid. */
    public function getFees(\Event $event, ?int $personID=null): array {
        $where = "WHERE status != 0 AND assocType = 'Event' AND assocID = ?";
        $params = [$event->id];
        if ($personID) {
            $where .= " AND personID = ?";
            $params[] = $personID;
        }
        $data = [];
        foreach ($this->_db->Fee->select($where, ...$params) as $fee) {
            $data[] = [
                'feeID'    => $fee->id,
                'personID' => (int)$fee->personID,
                'name'     => $fee->name,
                'amount'   => (float)$fee->amount,
                'date'     => $fee->date,
                'dueDate'  => $fee->dueDate,
                'account'  => $fee->account,
                'paid'     => (float)$this->_db->execute(
                    "SELECT COALESCE(SUM(amount), 0) FROM Transaction WHERE status > 0 AND feeID = ?", $fee->id
                )->fetchColumn(),
            ];
        }
        return $data;
    }

    /**
     * Charge a registration to the club's ledger, so it lands in the finance
     * screens, invoicing and Xero sync the club already uses.
     *
     * Follows the platform's own charge conventions rather than calling
     * Event::applyFee (which omits NOT NULL columns that only default under
     * non-strict MySQL): assocType 'Event' for a normal event, 'Program' for a
     * programme day — exactly what EventPerson::fee() reads back. It refuses to
     * charge the same person twice, so a retried registration cannot double-bill.
     */
    public function postFee(): array {
        $event = $this->_db->Event($this->need('eventID'));
        if (!$event || $event->status < 1) throw new \ApiException('Event not found', 422);
        $person = $this->requirePerson($this->need('personID'));

        $ep = $this->_db->EventPerson->get(['eventID'=>$event->id, 'personID'=>$person->id]);
        if (!$ep) {
            $ep = $this->_db->EventPerson->create([
                'eventID'  => $event->id,
                'personID' => $person->id,
                'status'   => \EventPerson::STATUS_CONFIRMED,
                'type'     => \EventPerson::TYPE_DEFAULT,
                'hours'    => 0,
                'name'     => '',
                'note'     => '',
            ]);
        }

        // Refuse to charge the same person twice for the same event — the same
        // guard Event::applyFee() applies, so a retried registration is safe.
        if ($existing = $ep->fee()) {
            return ['feeID'=>$existing->id, 'created'=>false, 'reason'=>'already charged'];
        }

        $amount = (float)($this->opt('amount') ?? $event->fee);
        if ($amount <= 0) {
            return ['feeID'=>null, 'created'=>false, 'reason'=>'no amount to charge'];
        }

        // A programme day is charged against the PROGRAMME, not the day — that is
        // how EventPerson::fee() looks it up, and it is what bills a family once
        // for the week instead of once per morning. Getting this wrong would hide
        // the charge from the old system AND defeat the duplicate guard above.
        $isProgramme = $event->type == \Event::TYPE_PROGRAM && $event->programID;

        $fee = $this->_db->Fee->create([
            'personID'       => $person->id,
            'assocType'      => $isProgramme ? 'Program' : 'Event',
            'assocID'        => $isProgramme ? $event->programID : $event->id,
            'name'           => $this->opt('name') ?: $event->name(true),
            'date'           => date('Y-m-d'),
            'dueDate'        => $event->feeDue(),
            'amount'         => $amount,
            'account'        => $this->opt('account') ?? $event->account,
            'type'           => \Fee::TYPE_INVOICE,
            'notes'          => $this->opt('notes', ''),
            'promptDiscount' => 0,
        ]);

        return ['feeID'=>$fee->id, 'created'=>true, 'amount'=>(float)$fee->amount];
    }
}
