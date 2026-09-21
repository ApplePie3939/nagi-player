import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playlist } from './playlist';
import type { PlaylistItem } from './types';
import './App.css';

const HIDDEN_BUNDLED_ITEMS_KEY = 'nagi-player.hidden-bundled-items';

type PlaylistSource = 'bundled' | 'local';
type DisplayPlaylistItem = PlaylistItem & { source: PlaylistSource };

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const readHiddenBundledIds = (): string[] => {
  try {
    const value = localStorage.getItem(HIDDEN_BUNDLED_ITEMS_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : [];
  } catch {
    return [];
  }
};

const supportsPictureInPicture = () =>
  typeof document !== 'undefined' && document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function';

type SafariVideoElement = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

const supportsFullscreen = () =>
  typeof document !== 'undefined' &&
  (document.fullscreenEnabled || typeof (HTMLVideoElement.prototype as SafariVideoElement).webkitEnterFullscreen === 'function');

export default function App() {
  const [localPlaylist, setLocalPlaylist] = useState<PlaylistItem[]>([]);
  const [hiddenBundledIds, setHiddenBundledIds] = useState<string[]>(readHiddenBundledIds);
  const [selectedId, setSelectedId] = useState<string | null>(() => playlist[0]?.id ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldAutoplay = useRef(false);
  const localMediaUrls = useRef(new Set<string>());

  const bundledPlaylist = useMemo<DisplayPlaylistItem[]>(() => playlist
    .filter(item => !hiddenBundledIds.includes(item.id))
    .map(item => ({ ...item, source: 'bundled' })), [hiddenBundledIds]);
  const allPlaylist = useMemo<DisplayPlaylistItem[]>(() => [
    ...bundledPlaylist,
    ...localPlaylist.map(item => ({ ...item, source: 'local' as const })),
  ], [bundledPlaylist, localPlaylist]);
  const hiddenBundledItems = useMemo(() => playlist.filter(item => hiddenBundledIds.includes(item.id)), [hiddenBundledIds]);
  const selectedIndex = allPlaylist.findIndex(item => item.id === selectedId);
  const selected = selectedIndex >= 0 ? allPlaylist[selectedIndex] : undefined;

  const activeElement = useCallback((item = selected): HTMLMediaElement | null => {
    if (!item) return null;
    return item.kind === 'audio' ? audioRef.current : videoRef.current;
  }, [selected]);

  const pauseInactive = useCallback((kind: PlaylistItem['kind']) => {
    const inactive = kind === 'audio' ? videoRef.current : audioRef.current;
    inactive?.pause();
  }, []);

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause();
    videoRef.current?.pause();
    shouldAutoplay.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }, []);

  const syncMediaSession = useCallback((item: PlaylistItem, playing: boolean) => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.title,
      artist: item.artist,
      album: '凪プレイヤー',
      ...(item.artworkUrl ? { artwork: [{ src: item.artworkUrl }] } : {}),
    });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, []);

  const select = useCallback((id: string | null, autoplay = false) => {
    const next = allPlaylist.find(item => item.id === id);
    stopPlayback();
    shouldAutoplay.current = autoplay && Boolean(next);
    setSelectedId(next?.id ?? null);
  }, [allPlaylist, stopPlayback]);

  const playSelected = useCallback(async () => {
    const media = activeElement();
    if (!media || !selected) return;
    pauseInactive(selected.kind);
    try {
      await media.play();
    } catch {
      setIsPlaying(false);
    }
  }, [activeElement, pauseInactive, selected]);

  const selectRelative = useCallback((offset: number, autoplay = true) => {
    if (selectedIndex < 0) return;
    const next = allPlaylist[selectedIndex + offset];
    if (next) select(next.id, autoplay);
  }, [allPlaylist, select, selectedIndex]);

  const playNext = useCallback((autoplay = true) => {
    if (selectedIndex < 0 || selectedIndex >= allPlaylist.length - 1) {
      activeElement()?.pause();
      shouldAutoplay.current = false;
      setIsPlaying(false);
      return;
    }
    selectRelative(1, autoplay);
  }, [activeElement, allPlaylist.length, selectRelative, selectedIndex]);

  useEffect(() => () => {
    localMediaUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_BUNDLED_ITEMS_KEY, JSON.stringify(hiddenBundledIds));
    } catch { /* Storage is unavailable; the current-session setting still works. */ }
  }, [hiddenBundledIds]);

  useEffect(() => {
    setPictureInPictureSupported(supportsPictureInPicture());
    setFullscreenSupported(supportsFullscreen());
  }, []);

  useEffect(() => {
    const media = activeElement();
    if (!media || !selected) return;
    media.load();
    syncMediaSession(selected, false);
    if (shouldAutoplay.current) {
      shouldAutoplay.current = false;
      void playSelected();
    }
  }, [activeElement, playSelected, selected, syncMediaSession]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const seek = (offset: number) => {
      const media = activeElement();
      if (media) media.currentTime = Math.max(0, Math.min(media.duration || Infinity, media.currentTime + offset));
    };
    navigator.mediaSession.setActionHandler('play', () => void playSelected());
    navigator.mediaSession.setActionHandler('pause', () => activeElement()?.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => selectRelative(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    navigator.mediaSession.setActionHandler('seekbackward', () => seek(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => seek(10));
    navigator.mediaSession.setActionHandler('seekto', details => {
      const media = activeElement();
      if (media && details.seekTime !== undefined) media.currentTime = details.seekTime;
    });
  }, [activeElement, playNext, playSelected, selectRelative]);

  const handleLoadedMetadata = (event: React.SyntheticEvent<HTMLMediaElement>) => setDuration(event.currentTarget.duration);
  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLMediaElement>) => setCurrentTime(event.currentTarget.currentTime);
  const handlePlay = () => { if (selected) { setIsPlaying(true); syncMediaSession(selected, true); } };
  const handlePause = () => { if (selected) { setIsPlaying(false); syncMediaSession(selected, false); } };
  const seek = (value: number) => { const media = activeElement(); if (media) media.currentTime = value; };

  const addLocalFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const additions = files.map((file, index): PlaylistItem => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(file.name);
      const mediaUrl = URL.createObjectURL(file);
      localMediaUrls.current.add(mediaUrl);
      return {
        id: `local-${Date.now()}-${index}-${file.name}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: 'この端末のファイル',
        kind: isVideo ? 'video' : 'audio',
        mediaUrl,
      };
    });
    if (additions.length) {
      setLocalPlaylist(items => [...items, ...additions]);
      if (!selected) setSelectedId(additions[0].id);
    }
    event.target.value = '';
  };

  const removeItem = (item: DisplayPlaylistItem) => {
    const message = item.source === 'local'
      ? `「${item.title}」を再生リストから削除しますか？\n端末の元ファイルは削除されません。`
      : `「${item.title}」をこのブラウザで非表示にしますか？\n編集モードから後で表示に戻せます。`;
    if (!window.confirm(message)) return;

    const itemIndex = allPlaylist.findIndex(candidate => candidate.id === item.id);
    const nextItem = selectedId === item.id
      ? allPlaylist[itemIndex + 1] ?? allPlaylist[itemIndex - 1]
      : undefined;
    if (selectedId === item.id) select(nextItem?.id ?? null);

    if (item.source === 'local') {
      setLocalPlaylist(items => items.filter(candidate => candidate.id !== item.id));
      URL.revokeObjectURL(item.mediaUrl);
      localMediaUrls.current.delete(item.mediaUrl);
    } else {
      setHiddenBundledIds(ids => ids.includes(item.id) ? ids : [...ids, item.id]);
    }
  };

  const restoreBundledItem = (id: string) => setHiddenBundledIds(ids => ids.filter(itemId => itemId !== id));
  const toggle = () => isPlaying ? activeElement()?.pause() : void playSelected();

  const startPictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || document.pictureInPictureElement) return;
    try { await video.requestPictureInPicture(); } catch { /* Browser denied the request. */ }
  };

  const enterFullscreen = async () => {
    const video = videoRef.current as SafariVideoElement | null;
    if (!video) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (video.requestFullscreen) await video.requestFullscreen();
      else video.webkitEnterFullscreen?.();
    } catch { /* Browser denied the request. */ }
  };

  const mediaEvents = { onLoadedMetadata: handleLoadedMetadata, onTimeUpdate: handleTimeUpdate, onPlay: handlePlay, onPause: handlePause, onEnded: () => playNext() };

  return <main className="page">
    <header><h1>凪プレイヤー</h1><p>同梱メディアを、いつでも。</p></header>
    <section className="local-files" aria-labelledby="local-files-title">
      <div><h2 id="local-files-title">端末のファイルを再生</h2><p>選んだ音声・動画は、この端末とブラウザ内だけで扱われます。</p></div>
      <label className="file-picker">ファイルを選ぶ<input type="file" accept="audio/*,video/*,.mp3,.m4a,.aac,.wav,.flac,.mp4,.m4v,.mov,.webm" multiple onChange={addLocalFiles} /></label>
    </section>
    <audio ref={audioRef} src={selected?.kind === 'audio' ? selected.mediaUrl : undefined} preload="metadata" {...mediaEvents} />
    {selected ? <>
      {selected.kind === 'video' && <video ref={videoRef} className="video" src={selected.mediaUrl} playsInline preload="metadata" {...mediaEvents} />}
      {selected.kind === 'audio' && (selected.artworkUrl ? <img className="artwork" src={selected.artworkUrl} alt={`${selected.title}のアートワーク`} /> : <div className="artwork placeholder" aria-hidden="true">♪</div>)}
      <section className="now-playing" aria-live="polite"><span>{selected.kind === 'audio' ? '音声' : '動画'}</span><h2>{selected.title}</h2><p>{selected.artist}</p></section>
      <input className="progress" type="range" aria-label="再生位置" value={currentTime} min="0" max={Math.max(duration, 1)} step="0.1" onChange={event => seek(Number(event.target.value))} />
      <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
      <div className="controls"><button onClick={() => selectRelative(-1)} disabled={selectedIndex <= 0}>前へ</button><button className="primary" onClick={toggle}>{isPlaying ? '一時停止' : '再生'}</button><button onClick={() => selectRelative(1)} disabled={selectedIndex >= allPlaylist.length - 1}>次へ</button></div>
      {selected.kind === 'video' && (pictureInPictureSupported || fullscreenSupported) && <div className="video-actions">
        {fullscreenSupported && <button className="video-action" onClick={() => void enterFullscreen()}>全画面表示</button>}
        {pictureInPictureSupported && <button className="video-action" onClick={() => void startPictureInPicture()}>ピクチャ・イン・ピクチャを開始</button>}
      </div>}
    </> : <section className="empty-player" aria-live="polite"><span>♪</span><h2>再生するファイルがありません</h2><p>上の「ファイルを選ぶ」から、端末内の音声・動画を追加できます。</p></section>}
    <section className="playlist">
      <div className="playlist-heading"><h2>再生リスト</h2><button className="edit-button" onClick={() => setIsEditing(editing => !editing)} aria-pressed={isEditing}>{isEditing ? '完了' : '編集'}</button></div>
      {allPlaylist.map(item => <div key={item.id} className={`playlist-row ${item.id === selectedId ? 'selected' : ''}`}>
        <button className="playlist-select" onClick={() => select(item.id)}><span><strong>{item.title}</strong><small>{item.artist}</small></span><em>{item.kind === 'audio' ? '音声' : '動画'}</em></button>
        {isEditing && <button className="remove-button" onClick={() => removeItem(item)}>{item.source === 'local' ? '削除' : '非表示'}</button>}
      </div>)}
      {!allPlaylist.length && <p className="empty-playlist">再生リストは空です。</p>}
      {isEditing && hiddenBundledItems.length > 0 && <section className="hidden-items" aria-labelledby="hidden-items-title"><h3 id="hidden-items-title">非表示の素材</h3>{hiddenBundledItems.map(item => <div className="hidden-row" key={item.id}><span><strong>{item.title}</strong><small>{item.artist}</small></span><button className="restore-button" onClick={() => restoreBundledItem(item.id)}>表示に戻す</button></div>)}</section>}
    </section>
    <p className="notice">対応ブラウザでは、メディア操作、全画面表示、ピクチャ・イン・ピクチャを利用できます。</p>
  </main>;
}
