// SEED FLAVOURS — a "club style" that themes what the blocks create so the demo data
// reads like a real club of that kind. The Seed tab picks one; the SeedContext
// resolves it; the group / venue / event / discipline / people-type blocks read from
// it. Keys match SEED_FLAVOURS in shared/contracts/devSeed.ts.

export interface PersonTypeDef { key: string; label: string; isAccess?: boolean }

export interface FlavourData {
  key: string
  label: string
  sport: string
  // Programmes (umbrella codes) and the classes that hang under each.
  programmes: { name: string; color: string; classes: string[] }[]
  // The venue/facility this club hires out.
  venue: { facility: string; areas: string[]; activity: string; modes: { name: string; price: number }[] }
  // Event title pool.
  events: string[]
  // Person types for this club style + which key a plain member / a coach gets.
  personTypes: PersonTypeDef[]
  memberType: { key: string; label: string }
  coachType: { key: string; label: string }
}

export const FLAVOURS: Record<string, FlavourData> = {
  gymnastics: {
    key: 'gymnastics',
    label: 'Gymnastics club',
    sport: 'Gymnastics',
    programmes: [
      { name: 'Development', color: '#3B82F6', classes: ['Kindergym', 'Tiny Tots', 'Beginners Mon', 'Beginners Wed', 'Little Stars'] },
      { name: 'Recreational', color: '#10B981', classes: ['Rec Level 1', 'Rec Level 2', 'Rec Level 3', 'Home School'] },
      { name: 'Competitive', color: '#EF4444', classes: ['Step 2', 'Step 4', 'Step 6', 'Elite Squad'] },
      { name: 'Teen & Adult', color: '#8B5CF6', classes: ['Adult Gymnastics', 'Teen Tumbling', 'Trampoline'] },
    ],
    venue: { facility: 'Main Gym', areas: ['Floor Area', 'Beam & Bars', 'Trampoline Zone'], activity: 'Open Gym', modes: [{ name: 'Casual entry', price: 12 }, { name: '10-visit pass', price: 100 }] },
    events: ['Club Championships', 'Holiday Programme', 'Open Morning', 'Step Competition', 'Grading Day', 'Display Night', 'Come & Try Day'],
    personTypes: [
      { key: 'gymnast', label: 'Gymnast' },
      { key: 'parent', label: 'Parent/Guardian' },
      { key: 'coach', label: 'Coach' },
      { key: 'judge', label: 'Judge' },
      { key: 'team_manager', label: 'Team Manager' },
      { key: 'admin', label: 'Administrator', isAccess: true },
    ],
    memberType: { key: 'gymnast', label: 'Gymnast' },
    coachType: { key: 'coach', label: 'Coach' },
  },
  football: {
    key: 'football',
    label: 'Football club',
    sport: 'Football',
    programmes: [
      { name: 'Junior Football', color: '#10B981', classes: ['Under 6s', 'Under 8s', 'Under 10s', 'Under 12s'] },
      { name: 'Youth Academy', color: '#3B82F6', classes: ['Under 14s', 'Under 16s', 'Development Squad'] },
      { name: 'Senior Teams', color: '#EF4444', classes: ['Reserves', 'First Team', 'Masters'] },
      { name: 'Football Fun', color: '#F59E0B', classes: ['Kicks for Kids', 'Walking Football', 'Holiday Camp'] },
    ],
    venue: { facility: 'Football Grounds', areas: ['Main Pitch', 'Pitch 2', 'Training Field'], activity: 'Ground Hire', modes: [{ name: 'Full pitch (1hr)', price: 40 }, { name: 'Half pitch (1hr)', price: 25 }] },
    events: ['Season Kickoff', 'Club Tournament', 'Football Festival', 'Awards Night', 'Trial Day', 'Family Fun Day', 'Cup Final'],
    personTypes: [
      { key: 'player', label: 'Player' },
      { key: 'parent', label: 'Parent/Guardian' },
      { key: 'coach', label: 'Coach' },
      { key: 'referee', label: 'Referee' },
      { key: 'team_manager', label: 'Team Manager' },
      { key: 'committee', label: 'Committee', isAccess: true },
      { key: 'admin', label: 'Administrator', isAccess: true },
    ],
    memberType: { key: 'player', label: 'Player' },
    coachType: { key: 'coach', label: 'Coach' },
  },
  racquets: {
    key: 'racquets',
    label: 'Multisport racquets club',
    sport: 'Tennis',
    programmes: [
      { name: 'Tennis', color: '#10B981', classes: ['Hot Shots', 'Junior Tennis', 'Adult Tennis', 'Cardio Tennis'] },
      { name: 'Badminton', color: '#3B82F6', classes: ['Junior Badminton', 'Social Badminton', 'Competitive Badminton'] },
      { name: 'Squash', color: '#EF4444', classes: ['Junior Squash', 'Club Squash', 'Squash Ladder'] },
      { name: 'Pickleball', color: '#F59E0B', classes: ['Beginner Pickleball', 'Social Pickleball'] },
    ],
    venue: { facility: 'Racquets Centre', areas: ['Court 1', 'Court 2', 'Court 3', 'Court 4'], activity: 'Court Hire', modes: [{ name: 'Singles (1hr)', price: 20 }, { name: 'Doubles (1hr)', price: 28 }] },
    events: ['Club Champs', 'Interclub', 'Open Day', 'Ladder Finals', 'Junior Tournament', 'Social Mixer', 'Come & Try'],
    personTypes: [
      { key: 'member', label: 'Member' },
      { key: 'junior_member', label: 'Junior Member' },
      { key: 'parent', label: 'Parent/Guardian' },
      { key: 'coach', label: 'Coach' },
      { key: 'committee', label: 'Committee', isAccess: true },
      { key: 'admin', label: 'Administrator', isAccess: true },
    ],
    memberType: { key: 'member', label: 'Member' },
    coachType: { key: 'coach', label: 'Coach' },
  },
}

export const DEFAULT_FLAVOUR = 'gymnastics'

export function resolveFlavour(key?: string | null): FlavourData {
  return FLAVOURS[key ?? ''] ?? FLAVOURS[DEFAULT_FLAVOUR]
}
