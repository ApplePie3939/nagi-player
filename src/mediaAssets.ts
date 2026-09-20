import type { LocalAsset } from './types';

/**
 * Bundled-file registration lives here, deliberately separate from playlist
 * metadata. Replace each null with a static Metro require when licensed files
 * are provided, e.g. `require('../assets/media/morning.mp3')`.
 */
export const mediaAssets: Record<'morning' | 'movie', LocalAsset> = {
  morning: require('../assets/media/taiko2.mp3'),
  movie: require('../assets/media/Cat_Jumpscare.webm.1080p.vp9.mp4'),
};

/** Artwork can be registered independently from media while test clips are prepared. */
export const artworkAssets: Record<'morning' | 'movie', LocalAsset> = {
  morning: require('../assets/artwork/taiko2.png'),
  movie: require('../assets/artwork/moomin2.png'),
};
