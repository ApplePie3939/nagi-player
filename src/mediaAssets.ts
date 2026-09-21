import morningMedia from '../assets/media/taiko2.mp3';
import movieMedia from '../assets/media/cat-jumpscare-h264.mp4';
import morningArtwork from '../assets/artwork/taiko2.png';
import movieArtwork from '../assets/artwork/moomin2.png';

/**
 * Bundled-file registration lives here, deliberately separate from playlist
 * metadata. Replace each null with a static Metro require when licensed files
 * are provided, e.g. `require('../assets/media/morning.mp3')`.
 */
export const mediaAssets = {
  morning: morningMedia,
  movie: movieMedia,
};

/** Artwork can be registered independently from media while test clips are prepared. */
export const artworkAssets = {
  morning: morningArtwork,
  movie: movieArtwork,
};
