// How an interaction happened, tagged on a note (person_notes.channel, migration
// 224). Shared so the add-note form, the add-person dialog, and the notes feed
// all use the same list + icons.
export interface NoteChannel { value: string; label: string; icon: string }

export const NOTE_CHANNELS: NoteChannel[] = [
  { value: 'in_person', label: 'In person',  icon: 'pi-user' },
  { value: 'phone',     label: 'Phone call',  icon: 'pi-phone' },
  { value: 'email',     label: 'Email',       icon: 'pi-envelope' },
  { value: 'sms',       label: 'Text / SMS',  icon: 'pi-comment' },
  { value: 'mail',      label: 'Post / mail', icon: 'pi-send' },
  { value: 'other',     label: 'Other',       icon: 'pi-ellipsis-h' },
]

export function useNoteChannels() {
  const byValue = Object.fromEntries(NOTE_CHANNELS.map(c => [c.value, c])) as Record<string, NoteChannel>
  const channelLabel = (v: string | null | undefined) => (v ? byValue[v]?.label ?? v : '')
  const channelIcon = (v: string | null | undefined) => (v ? byValue[v]?.icon ?? 'pi-comment' : 'pi-comment')
  return { NOTE_CHANNELS, channelLabel, channelIcon }
}
