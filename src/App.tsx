import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playlist } from './playlist';
import { deleteLocalMedia, loadLocalMedia, saveLocalMedia, setLocalMediaHidden } from './localMediaStorage';
import type { PlaylistItem } from './types';
import './App.css';

const HIDDEN_BUNDLED_ITEMS_KEY = 'nagi-player.hidden-bundled-items';
const MAX_LOCAL_FILE_COUNT = 20;
const MAX_LOCAL_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const SUPPORTED_LOCAL_FILE_EXTENSIONS = /\.(mp3|m4a|aac|wav|flac|mp4|m4v|mov|webm)$/i;
const VIDEO_FILE_EXTENSIONS = /\.(mp4|m4v|mov|webm)$/i;

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
type AudioSessionNavigator = Navigator & {
  audioSession?: { type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record' };
};

const supportsFullscreen = () =>
  typeof document !== 'undefined' &&
  (document.fullscreenEnabled || typeof (HTMLVideoElement.prototype as SafariVideoElement).webkitEnterFullscreen === 'function');

const requestPlaybackAudioSession = () => {
  // This is progressive enhancement: HTML media already has this intent by default,
  // but supported browsers can use the explicit session when the app is backgrounded.
  const audioSession = (navigator as AudioSessionNavigator).audioSession;
  if (!audioSession) return;
  try {
    audioSession.type = 'playback';
  } catch { /* The browser declined the optional audio-session request. */ }
};

export default function App() {
  const [localPlaylist, setLocalPlaylist] = useState<PlaylistItem[]>([]);
  const [hiddenLocalPlaylist, setHiddenLocalPlaylist] = useState<PlaylistItem[]>([]);
  const [localFileError, setLocalFileError] = useState<string | null>(null);
  const [isLocalMediaReady, setIsLocalMediaReady] = useState(false);
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
    const isReselectingCurrentItem = next?.id === selectedId;
    stopPlayback();
    shouldAutoplay.current = autoplay && Boolean(next);
    setSelectedId(next?.id ?? null);

    // Changing state to the same id does not re-run the media-loading effect.
    // Reload it explicitly so the element and the displayed time always reset together.
    if (isReselectingCurrentItem) activeElement(next)?.load();
  }, [activeElement, allPlaylist, selectedId, stopPlayback]);

  const playSelected = useCallback(async () => {
    const media = activeElement();
    if (!media || !selected) return;
    pauseInactive(selected.kind);
    requestPlaybackAudioSession();
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
    let isCurrent = true;
    void loadLocalMedia().then(items => {
      if (!isCurrent) return;
      const restored = items.map(item => {
        const mediaUrl = URL.createObjectURL(item.file);
        localMediaUrls.current.add(mediaUrl);
        return {
          id: item.id,
          title: item.title,
          artist: 'この端末のファイル',
          kind: item.kind,
          mediaUrl,
        } satisfies PlaylistItem;
      });
      setLocalPlaylist(restored.filter(item => !items.find(stored => stored.id === item.id)?.hidden));
      setHiddenLocalPlaylist(restored.filter(item => items.find(stored => stored.id === item.id)?.hidden));
    }).catch(() => {
      if (isCurrent) setLocalFileError('端末内のファイルを復元できませんでした。');
    }).finally(() => {
      if (isCurrent) setIsLocalMediaReady(true);
    });
    return () => { isCurrent = false; };
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

  // Both media elements can emit a final pause/time event while switching tracks.
  // Only let the currently selected element update the player UI.
  const isSelectedMediaEvent = (media: HTMLMediaElement) => media === activeElement();
  const handleLoadedMetadata = (event: React.SyntheticEvent<HTMLMediaElement>) => {
    if (isSelectedMediaEvent(event.currentTarget)) {
      const nextDuration = event.currentTarget.duration;
      setDuration(Number.isFinite(nextDuration) && nextDuration >= 0 ? nextDuration : 0);
    }
  };
  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLMediaElement>) => {
    if (isSelectedMediaEvent(event.currentTarget)) {
      const nextTime = event.currentTarget.currentTime;
      setCurrentTime(Number.isFinite(nextTime) && nextTime >= 0 ? nextTime : 0);
    }
  };
  const handlePlay = (event: React.SyntheticEvent<HTMLMediaElement>) => {
    if (selected && isSelectedMediaEvent(event.currentTarget)) { setIsPlaying(true); syncMediaSession(selected, true); }
  };
  const handlePause = (event: React.SyntheticEvent<HTMLMediaElement>) => {
    if (selected && isSelectedMediaEvent(event.currentTarget)) { setIsPlaying(false); syncMediaSession(selected, false); }
  };
  const seek = (value: number) => { const media = activeElement(); if (media) media.currentTime = value; };

  const addLocalFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const availableSlots = Math.max(0, MAX_LOCAL_FILE_COUNT - localPlaylist.length - hiddenLocalPlaylist.length);
    const validFiles = files.filter(file =>
      (file.type.startsWith('audio/') || file.type.startsWith('video/') || SUPPORTED_LOCAL_FILE_EXTENSIONS.test(file.name)) &&
      file.size <= MAX_LOCAL_FILE_BYTES,
    );
    const acceptedFiles = validFiles.slice(0, availableSlots);
    const messages: string[] = [];
    if (files.some(file => !file.type.startsWith('audio/') && !file.type.startsWith('video/') && !SUPPORTED_LOCAL_FILE_EXTENSIONS.test(file.name))) {
      messages.push('対応していないファイル形式は追加されませんでした。');
    }
    if (files.some(file => file.size > MAX_LOCAL_FILE_BYTES)) {
      messages.push('1ファイル5 GBまで追加できます。');
    }
    if (validFiles.length > acceptedFiles.length) {
      messages.push(`端末のファイルは最大${MAX_LOCAL_FILE_COUNT}件まで追加できます。`);
    }
    setLocalFileError(messages.length ? messages.join(' ') : null);

    const additions = acceptedFiles.map((file): PlaylistItem => {
      const isVideo = file.type.startsWith('video/') || VIDEO_FILE_EXTENSIONS.test(file.name);
      const mediaUrl = URL.createObjectURL(file);
      localMediaUrls.current.add(mediaUrl);
      return {
        id: `local-${crypto.randomUUID()}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: 'この端末のファイル',
        kind: isVideo ? 'video' : 'audio',
        mediaUrl,
      };
    });
    if (additions.length) {
      try {
        await Promise.all(additions.map((item, index) => saveLocalMedia({
          id: item.id,
          title: item.title,
          kind: item.kind,
          hidden: false,
          file: acceptedFiles[index],
        })));
      } catch {
        additions.forEach(item => {
          URL.revokeObjectURL(item.mediaUrl);
          localMediaUrls.current.delete(item.mediaUrl);
        });
        setLocalFileError('端末内のファイルを保存できませんでした。ブラウザの保存容量を確認してください。');
        event.target.value = '';
        return;
      }
      setLocalPlaylist(items => [...items, ...additions]);
      if (!selected) setSelectedId(additions[0].id);
    }
    event.target.value = '';
  };

  const selectReplacementItem = (item: DisplayPlaylistItem) => {
    if (selectedId !== item.id) return;
    const itemIndex = allPlaylist.findIndex(candidate => candidate.id === item.id);
    const nextItem = allPlaylist[itemIndex + 1] ?? allPlaylist[itemIndex - 1];
    select(nextItem?.id ?? null);
  };

  const removeItem = (item: DisplayPlaylistItem) => {
    const message = item.source === 'local'
      ? `「${item.title}」を再生リストから削除しますか？\n端末の元ファイルは削除されません。`
      : `「${item.title}」をこのブラウザで非表示にしますか？\n編集モードから後で表示に戻せます。`;
    if (!window.confirm(message)) return;

    selectReplacementItem(item);

    if (item.source === 'local') {
      setLocalPlaylist(items => items.filter(candidate => candidate.id !== item.id));
      void deleteLocalMedia(item.id).catch(() => setLocalFileError('端末内のファイルを削除できませんでした。'));
      URL.revokeObjectURL(item.mediaUrl);
      localMediaUrls.current.delete(item.mediaUrl);
    } else {
      setHiddenBundledIds(ids => ids.includes(item.id) ? ids : [...ids, item.id]);
    }
  };

  const hideLocalItem = (item: DisplayPlaylistItem) => {
    if (!window.confirm(`「${item.title}」をこの画面で非表示にしますか？\n編集モードから後で表示に戻せます。`)) return;

    selectReplacementItem(item);
    setLocalPlaylist(items => items.filter(candidate => candidate.id !== item.id));
    setHiddenLocalPlaylist(items => [...items, item]);
    void setLocalMediaHidden(item.id, true).catch(() => setLocalFileError('非表示の状態を保存できませんでした。'));
  };

  const restoreBundledItem = (id: string) => setHiddenBundledIds(ids => ids.filter(itemId => itemId !== id));
  const restoreLocalItem = (id: string) => {
    const item = hiddenLocalPlaylist.find(candidate => candidate.id === id);
    if (!item) return;
    setHiddenLocalPlaylist(items => items.filter(candidate => candidate.id !== id));
    setLocalPlaylist(items => [...items, item]);
    void setLocalMediaHidden(id, false).catch(() => setLocalFileError('表示状態を保存できませんでした。'));
    if (!selectedId) setSelectedId(item.id);
  };
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

  const mediaEvents = {
    onLoadedMetadata: handleLoadedMetadata,
    onTimeUpdate: handleTimeUpdate,
    onPlay: handlePlay,
    onPause: handlePause,
    onEnded: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      if (isSelectedMediaEvent(event.currentTarget)) playNext();
    },
  };

  return <main className="page">
    <header><h1>凪プレイヤー</h1><p>同梱メディアを、いつでも。</p></header>
    <section className="local-files" aria-labelledby="local-files-title">
      <div><h2 id="local-files-title">端末のファイルを再生</h2><p>選んだ音声・動画は、この端末とブラウザ内だけで扱われます。</p></div>
      <label className="file-picker">{isLocalMediaReady ? 'ファイルを選ぶ' : '復元中…'}<input type="file" accept="audio/*,video/*,.mp3,.m4a,.aac,.wav,.flac,.mp4,.m4v,.mov,.webm" multiple onChange={event => void addLocalFiles(event)} disabled={!isLocalMediaReady} /></label>
    </section>
    {localFileError && <p className="local-file-error" role="alert">{localFileError}</p>}
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
        {isEditing && item.source === 'local' && <><button className="hide-button" onClick={() => hideLocalItem(item)}>非表示</button><button className="remove-button" onClick={() => removeItem(item)}>削除</button></>}
        {isEditing && item.source === 'bundled' && <button className="hide-button" onClick={() => removeItem(item)}>非表示</button>}
      </div>)}
      {!allPlaylist.length && <p className="empty-playlist">再生リストは空です。</p>}
      {isEditing && (hiddenBundledItems.length > 0 || hiddenLocalPlaylist.length > 0) && <section className="hidden-items" aria-labelledby="hidden-items-title"><h3 id="hidden-items-title">非表示の素材</h3>{hiddenBundledItems.map(item => <div className="hidden-row" key={item.id}><span><strong>{item.title}</strong><small>{item.artist}</small></span><button className="restore-button" onClick={() => restoreBundledItem(item.id)}>表示に戻す</button></div>)}{hiddenLocalPlaylist.map(item => <div className="hidden-row" key={item.id}><span><strong>{item.title}</strong><small>{item.artist}</small></span><button className="restore-button" onClick={() => restoreLocalItem(item.id)}>表示に戻す</button></div>)}</section>}
    </section>
    <p className="notice">対応ブラウザでは、メディア操作、全画面表示、ピクチャ・イン・ピクチャを利用できます。</p>
  </main>;
}
