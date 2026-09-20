module.exports = {
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,json,png,ico,mp3,mp4}'],
  swDest: 'dist/sw.js',
  maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  navigateFallback: 'index.html',
};
