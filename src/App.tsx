import { useCallback, useEffect, useRef, useState } from 'react';
import { playlist } from './playlist';
import type { PlaylistItem } from './types';
import './App.css';

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const supportsPictureInPicture = () =>
  typeof document !== 'undefined' && document.pictureInPictureEnabled && typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function';

type SafariVideoElement = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

const supportsFullscreen = () =>
  typeof document !== 'undefined' &&
  (document.fullscreenEnabled || typeof (HTMLVideoElement.prototype as SafariVideoElement).webkitEnterFullscreen === 'function');

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const shouldAutoplay = useRef(false);
  const selected = playlist[selectedIndex];

  const activeElement = useCallback((item = selected): HTMLMediaElement | null =>
    item.kind === 'audio' ? audioRef.current : videoRef.current, [selected]);

  const pauseInactive = useCallback((kind: PlaylistItem['kind']) => {
    const inactive = kind === 'audio' ? videoRef.current : audioRef.current;
    inactive?.pause();
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

  const playSelected = useCallback(async () => {
    const media = activeElement();
    if (!media || !selected.mediaUrl) return;
    pauseInactive(selected.kind);
    try {
      await media.play();
    } catch {
      setIsPlaying(false);
    }
  }, [activeElement, pauseInactive, selected]);

  const select = useCallback((index: number, autoplay = false) => {
    const next = playlist[index];
    audioRef.current?.pause();
    videoRef.current?.pause();
    shouldAutoplay.current = autoplay;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setSelectedIndex(index);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    if (!next.mediaUrl) shouldAutoplay.current = false;
  }, []);

  const playNext = useCallback((autoplay = true) => {
    if (selectedIndex >= playlist.length - 1) {
      activeElement()?.pause();
      shouldAutoplay.current = false;
      setIsPlaying(false);
      return;
    }
    select(selectedIndex + 1, autoplay);
  }, [activeElement, select, selectedIndex]);

  useEffect(() => {
    setPictureInPictureSupported(supportsPictureInPicture());
    setFullscreenSupported(supportsFullscreen());
  }, []);

  useEffect(() => {
    const media = activeElement();
    if (!media) return;
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
    navigator.mediaSession.setActionHandler('previoustrack', () => select(Math.max(0, selectedIndex - 1)));
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    navigator.mediaSession.setActionHandler('seekbackward', () => seek(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => seek(10));
    navigator.mediaSession.setActionHandler('seekto', details => {
      const media = activeElement();
      if (media && details.seekTime !== undefined) media.currentTime = details.seekTime;
    });
  }, [activeElement, playNext, playSelected, select, selectedIndex]);

  const handleLoadedMetadata = (event: React.SyntheticEvent<HTMLMediaElement>) => setDuration(event.currentTarget.duration);
  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLMediaElement>) => setCurrentTime(event.currentTarget.currentTime);
  const handlePlay = () => { setIsPlaying(true); syncMediaSession(selected, true); };
  const handlePause = () => { setIsPlaying(false); syncMediaSession(selected, false); };
  const handleEnded = () => playNext();
  const seek = (value: number) => { const media = activeElement(); if (media) media.currentTime = value; };

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

  const mediaEvents = { onLoadedMetadata: handleLoadedMetadata, onTimeUpdate: handleTimeUpdate, onPlay: handlePlay, onPause: handlePause, onEnded: handleEnded };

  return <main className="page">
    <header><h1>凪プレイヤー</h1><p>同梱メディアを、いつでも。</p></header>
    <audio ref={audioRef} src={selected.kind === 'audio' ? selected.mediaUrl : undefined} preload="metadata" {...mediaEvents} />
    {selected.kind === 'video' && <video ref={videoRef} className="video" src={selected.mediaUrl} playsInline preload="metadata" {...mediaEvents} />}
    {selected.kind === 'audio' && (selected.artworkUrl ? <img className="artwork" src={selected.artworkUrl} alt={`${selected.title}のアートワーク`} /> : <div className="artwork placeholder" aria-hidden="true">♪</div>)}
    <section className="now-playing" aria-live="polite"><span>{selected.kind === 'audio' ? '音声' : '動画'}</span><h2>{selected.title}</h2><p>{selected.artist}</p></section>
    <input className="progress" type="range" aria-label="再生位置" value={currentTime} min="0" max={Math.max(duration, 1)} step="0.1" onChange={event => seek(Number(event.target.value))} />
    <div className="time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
    <div className="controls"><button onClick={() => select(Math.max(0, selectedIndex - 1))} disabled={selectedIndex === 0}>前へ</button><button className="primary" onClick={toggle}>{isPlaying ? '一時停止' : '再生'}</button><button onClick={() => playNext()} disabled={selectedIndex === playlist.length - 1}>次へ</button></div>
    {selected.kind === 'video' && (pictureInPictureSupported || fullscreenSupported) && <div className="video-actions">
      {fullscreenSupported && <button className="video-action" onClick={() => void enterFullscreen()}>全画面表示</button>}
      {pictureInPictureSupported && <button className="video-action" onClick={() => void startPictureInPicture()}>ピクチャ・イン・ピクチャを開始</button>}
    </div>}
    <section className="playlist"><h2>再生リスト</h2>{playlist.map((item, index) => <button key={item.id} className={`playlist-row ${index === selectedIndex ? 'selected' : ''}`} onClick={() => select(index)}><span><strong>{item.title}</strong><small>{item.artist}</small></span><em>{item.kind === 'audio' ? '音声' : '動画'}</em></button>)}</section>
    <p className="notice">対応ブラウザでは、メディア操作、全画面表示、ピクチャ・イン・ピクチャを利用できます。</p>
  </main>;
}
