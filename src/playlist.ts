import { artworkAssets, mediaAssets } from './mediaAssets';
import type { PlaylistItem } from './types';

/** Fixed, bundled playlist. Add or edit metadata here, not in the UI. */
export const playlist: readonly PlaylistItem[] = [
  {
    id: 'morning',
    title: 'Taiko2（テスト）',
    artist: 'Singapore Wind Symphony',
    kind: 'audio',
    mediaUrl: mediaAssets.morning,
    artworkUrl: artworkAssets.morning,
  },
  {
    id: 'movie',
    title: 'Cat Jumpscare（テスト）',
    artist: 'Panini! / Wikimedia Commons',
    kind: 'video',
    mediaUrl: mediaAssets.movie,
    artworkUrl: artworkAssets.movie,
  },
];
