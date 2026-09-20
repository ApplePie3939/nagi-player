export type MediaKind = 'audio' | 'video';

/** Metro's numeric module reference for a bundled asset. */
export type LocalAsset = number | null;

export type PlaylistItem = {
  id: string;
  title: string;
  artist: string;
  kind: MediaKind;
  mediaAsset: LocalAsset;
  artworkAsset: LocalAsset;
};
