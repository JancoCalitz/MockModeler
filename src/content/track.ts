import { TRACK_IDS, type TrackId } from './schema.ts';

// Which certification someone last practised, so the app opens on it.
const TRACK_KEY = 'mockmodeler.track';

export function loadTrack(): TrackId {
  try {
    const saved = localStorage.getItem(TRACK_KEY);
    return TRACK_IDS.find((id) => id === saved) ?? 'associate';
  } catch {
    return 'associate';
  }
}

export function saveTrack(track: TrackId): void {
  try {
    localStorage.setItem(TRACK_KEY, track);
  } catch {
    // The choice still applies for this visit if the browser's storage is full.
  }
}
