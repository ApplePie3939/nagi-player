import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Asset } from 'expo-asset';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { VideoView } from 'expo-video';
import { playlist } from './src/playlist';
import type { PlaylistItem } from './src/types';

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const supportsPictureInPicture = () =>
  typeof document !== 'undefined' &&
  document.pictureInPictureEnabled === true &&
  typeof document.exitPictureInPicture === 'function';

export default function App() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false);
  const selected = playlist[selectedIndex];
  const videoShouldPlay = useRef(false);
  const preloadedVideoIndex = useRef<number | null>(null);
  const videoSourceUri = useRef<string | null>(null);
  const videoViewRef = useRef<VideoView>(null);

  const audioPlayer = useAudioPlayer(null, { updateInterval: 250 });
  const audioStatus = useAudioPlayerStatus(audioPlayer);

  const getVideoElement = () => videoViewRef.current?.nativeRef.current?.nativeRef as HTMLVideoElement | undefined;
  const getMediaUri = (item: PlaylistItem) => item.mediaAsset === null ? null : Asset.fromModule(item.mediaAsset).uri;

  const loadVideo = (item: PlaylistItem) => {
    const video = getVideoElement();
    const uri = getMediaUri(item);
    if (!video || !uri) return false;
    if (videoSourceUri.current !== uri) {
      video.pause();
      videoSourceUri.current = uri;
      video.src = uri;
      video.load();
      setVideoTime(0);
      setVideoDuration(0);
    }
    return true;
  };

  const playVideo = () => {
    const video = getVideoElement();
    if (!video) return;
    void video.play().catch(() => setVideoPlaying(false));
  };

  useEffect(() => {
    setPictureInPictureSupported(supportsPictureInPicture());
  }, []);

  useEffect(() => {
    const shouldAutoplay = videoShouldPlay.current;
    audioPlayer.pause();
    audioPlayer.clearLockScreenControls();
    if (selected.kind === 'audio') {
      getVideoElement()?.pause();
      setVideoPlaying(false);
      setVideoTime(0);
      setVideoDuration(0);
      videoShouldPlay.current = false;
      audioPlayer.replace(selected.mediaAsset);
      if (shouldAutoplay) audioPlayer.play();
      return;
    }

    if (preloadedVideoIndex.current === selectedIndex) {
      preloadedVideoIndex.current = null;
      return;
    }
    const loaded = loadVideo(selected);
    if (loaded && videoShouldPlay.current) playVideo();
    if (!loaded) setVideoPlaying(false);
  }, [audioPlayer, selected, selectedIndex]);

  const select = (index: number, autoplay = false, playVideoInUserGesture = false) => {
    const item = playlist[index];
    videoShouldPlay.current = autoplay;
    if (playVideoInUserGesture && item.kind === 'video' && loadVideo(item)) {
      preloadedVideoIndex.current = index;
      audioPlayer.pause();
      audioPlayer.clearLockScreenControls();
      playVideo();
    }
    setSelectedIndex(index);
  };

  function playNext(fromUserGesture = false) {
    if (selectedIndex >= playlist.length - 1) {
      audioPlayer.pause();
      getVideoElement()?.pause();
      videoShouldPlay.current = false;
      setVideoPlaying(false);
      return;
    }
    select(selectedIndex + 1, true, fromUserGesture);
  }

  useEffect(() => {
    if (audioStatus.didJustFinish && selected.kind === 'audio') playNext();
    // The transition is driven by one one-shot status flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStatus.didJustFinish]);

  useEffect(() => {
    const video = getVideoElement();
    if (!video) return;
    const updateTime = () => {
      setVideoTime(video.currentTime);
      setVideoDuration(video.duration);
    };
    const onEnded = () => {
      videoShouldPlay.current = false;
      setVideoPlaying(false);
      if (selected.kind === 'video') playNext();
    };
    const onPlay = () => setVideoPlaying(true);
    const onPause = () => setVideoPlaying(false);
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateTime);
    video.addEventListener('durationchange', updateTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateTime);
      video.removeEventListener('durationchange', updateTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [selected]);

  const artworkUri = useMemo(() => selected.artworkAsset === null ? undefined : Asset.fromModule(selected.artworkAsset).uri, [selected]);
  const startSelected = () => {
    if (selected.mediaAsset === null) {
      Alert.alert('素材が未登録です', 'assets/media と src/mediaAssets.ts に利用許諾済みの素材を登録してください。');
      return;
    }
    if (selected.kind === 'audio') {
      audioPlayer.setActiveForLockScreen(true, { title: selected.title, artist: selected.artist, albumTitle: '凪プレイヤー', ...(artworkUri ? { artworkUrl: artworkUri } : {}) });
      audioPlayer.play();
    } else {
      videoShouldPlay.current = true;
      if (loadVideo(selected)) playVideo();
    }
  };
  const isPlaying = selected.kind === 'audio' ? audioStatus.playing : videoPlaying;
  const currentTime = selected.kind === 'audio' ? audioStatus.currentTime : videoTime;
  const duration = selected.kind === 'audio' ? audioStatus.duration : videoDuration;
  const toggle = () => {
    if (!isPlaying) return startSelected();
    if (selected.kind === 'audio') return audioPlayer.pause();
    videoShouldPlay.current = false;
    getVideoElement()?.pause();
    setVideoPlaying(false);
  };

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.brand}>凪プレイヤー</Text><Text style={styles.caption}>同梱メディアを、いつでも。</Text>
    <VideoView ref={videoViewRef} style={[styles.video, selected.kind !== 'video' && styles.videoHidden]} contentFit="contain" nativeControls={false} fullscreenOptions={{ enable: false }} playsInline allowsPictureInPicture onFullscreenExit={() => { videoShouldPlay.current = false; getVideoElement()?.pause(); }} />
    {selected.kind === 'audio' && (artworkUri ? <Image source={{ uri: artworkUri }} style={styles.artwork} /> : <View style={[styles.artwork, styles.artworkPlaceholder]}><Text style={styles.artworkText}>♪</Text></View>)}
    <View style={styles.nowPlaying}><Text style={styles.kind}>{selected.kind === 'audio' ? '音声' : '動画'}</Text><Text style={styles.title}>{selected.title}</Text><Text style={styles.artist}>{selected.artist}</Text></View>
    <Slider value={currentTime} minimumValue={0} maximumValue={Math.max(duration, 1)} minimumTrackTintColor="#5a67d8" maximumTrackTintColor="#d8d9e8" thumbTintColor="#5a67d8" onSlidingComplete={value => { if (selected.kind === 'audio') void audioPlayer.seekTo(value); else { const video = getVideoElement(); if (video) video.currentTime = value; } }} />
    <View style={styles.timeRow}><Text>{formatTime(currentTime)}</Text><Text>{formatTime(duration)}</Text></View>
    <View style={styles.controls}><Control label="前へ" onPress={() => select(Math.max(0, selectedIndex - 1))} disabled={selectedIndex === 0} /><Control label={isPlaying ? '一時停止' : '再生'} primary onPress={toggle} /><Control label="次へ" onPress={() => playNext(true)} disabled={selectedIndex === playlist.length - 1} /></View>
    {selected.kind === 'video' && pictureInPictureSupported && <Pressable style={styles.pipButton} onPress={() => void videoViewRef.current?.startPictureInPicture().catch(() => undefined)}><Text style={styles.pipText}>ピクチャ・イン・ピクチャを開始</Text></Pressable>}
    <Text style={styles.sectionTitle}>再生リスト</Text>
    {playlist.map((item, index) => <PlaylistRow key={item.id} item={item} selected={index === selectedIndex} onPress={() => select(index)} />)}
    <Text style={styles.notice}>対応ブラウザでは、メディア操作とピクチャ・イン・ピクチャを利用できます。</Text>
  </ScrollView></SafeAreaView>;
}

function Control({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.control, primary && styles.primaryControl, disabled && styles.disabled]}><Text style={[styles.controlText, primary && styles.primaryText]}>{label}</Text></Pressable>;
}
function PlaylistRow({ item, selected, onPress }: { item: PlaylistItem; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.row, selected && styles.rowSelected]}><View><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowArtist}>{item.artist}</Text></View><Text style={styles.rowKind}>{item.kind === 'audio' ? '音声' : '動画'}</Text></Pressable>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f7fb' }, page: { padding: 24, paddingBottom: 48 }, brand: { fontSize: 28, fontWeight: '700', color: '#24243c' }, caption: { marginTop: 4, color: '#77788a' }, artwork: { width: '100%', aspectRatio: 1, borderRadius: 20, marginTop: 28, backgroundColor: '#e7e8f5' }, artworkPlaceholder: { alignItems: 'center', justifyContent: 'center' }, artworkText: { fontSize: 80, color: '#5a67d8' }, video: { width: '100%', aspectRatio: 16 / 9, marginTop: 28, borderRadius: 20, backgroundColor: '#151526' }, videoHidden: { display: 'none' }, nowPlaying: { alignItems: 'center', marginVertical: 20 }, kind: { color: '#5a67d8', fontWeight: '700', fontSize: 13 }, title: { color: '#24243c', fontWeight: '700', fontSize: 24, marginTop: 4 }, artist: { color: '#77788a', marginTop: 4 }, timeRow: { flexDirection: 'row', justifyContent: 'space-between', color: '#77788a' }, controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }, control: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18 }, primaryControl: { backgroundColor: '#5a67d8', minWidth: 94, alignItems: 'center' }, controlText: { color: '#4d4e63', fontWeight: '600' }, primaryText: { color: '#fff' }, disabled: { opacity: 0.35 }, pipButton: { alignItems: 'center', marginTop: 18, padding: 13, borderWidth: 1, borderColor: '#c7c9e7', borderRadius: 12 }, pipText: { color: '#4956b7', fontWeight: '600' }, sectionTitle: { fontSize: 18, fontWeight: '700', color: '#24243c', marginTop: 34, marginBottom: 10 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, padding: 14, marginBottom: 8, backgroundColor: '#fff' }, rowSelected: { borderWidth: 1, borderColor: '#5a67d8', backgroundColor: '#f0f1ff' }, rowTitle: { color: '#24243c', fontWeight: '600' }, rowArtist: { color: '#77788a', marginTop: 3, fontSize: 13 }, rowKind: { color: '#5a67d8', fontWeight: '600', fontSize: 13 }, notice: { color: '#77788a', textAlign: 'center', fontSize: 12, marginTop: 18 },
});
