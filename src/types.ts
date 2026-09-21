export type MediaKind = 'audio' | 'video';

export type PlaylistItem = {
  id: string;
  title: string;
  artist: string;
  kind: MediaKind;
  mediaUrl: string;
  artworkUrl?: string;
};
