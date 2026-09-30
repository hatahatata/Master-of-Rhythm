<script lang="ts">
  import type { ScreenState, Song, Difficulty, GameSettings, GameResult } from './types';
  import { loadSettings } from './utils/storage';
  import { sound } from './utils/audio';
  import { SONGS } from './data/songs';
  import { onMount } from 'svelte';

  import TitleScreen from './components/TitleScreen.svelte';
  import SettingsScreen from './components/SettingsScreen.svelte';
  import SongSelectScreen from './components/SongSelectScreen.svelte';
  import GameScreen from './components/GameScreen.svelte';
  import ResultScreen from './components/ResultScreen.svelte';

  let currentScreen = $state<ScreenState>('title');
  let settings = $state<GameSettings>(loadSettings());

  let selectedSong = $state<Song>(SONGS[0]);
  let selectedDifficulty = $state<Difficulty>('NORMAL');
  let lastResult = $state<GameResult | null>(null);

  let isPortrait = $state(false);

  function checkOrientation() {
    // 画面幅が高さより小さく、かつスマホ相当のサイズの場合に縦画面警告
    isPortrait = window.innerHeight > window.innerWidth && window.innerWidth <= 600;
  }

  onMount(() => {
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  });

  $effect(() => {
    sound.setVolumes(settings.bgmVolume, settings.seVolume);
  });

  function goToSettings() {
    currentScreen = 'settings';
  }

  function handleSettingsBack(newSettings: GameSettings) {
    settings = newSettings;
    currentScreen = 'title';
  }

  function goToSongSelect() {
    currentScreen = 'select';
  }

  function handleSongSelect(song: Song, diff: Difficulty) {
    selectedSong = song;
    selectedDifficulty = diff;
    currentScreen = 'game';
  }

  function handleGameFinish(result: GameResult) {
    lastResult = result;
    currentScreen = 'result';
  }

  function handleGameQuit() {
    currentScreen = 'select';
  }

  function handleRetryGame() {
    currentScreen = 'game';
  }
</script>

<main class="app-viewport">
  {#if currentScreen === 'title'}
    <TitleScreen 
      onStart={goToSongSelect} 
      onSettings={goToSettings} 
    />
  {:else if currentScreen === 'settings'}
    <SettingsScreen 
      settings={settings} 
      onBack={handleSettingsBack} 
    />
  {:else if currentScreen === 'select'}
    <SongSelectScreen 
      onSelect={handleSongSelect} 
      onBack={() => currentScreen = 'title'} 
    />
  {:else if currentScreen === 'game'}
    <GameScreen 
      song={selectedSong} 
      difficulty={selectedDifficulty} 
      settings={settings} 
      onFinish={handleGameFinish} 
      onQuit={handleGameQuit} 
    />
  {:else if currentScreen === 'result' && lastResult}
    <ResultScreen 
      result={lastResult} 
      onRetry={handleRetryGame} 
      onSelectMusic={goToSongSelect} 
    />
  {/if}

  <!-- スマホ縦向き時の回転案内 (Landscape Recommendation Overlay) -->
  {#if isPortrait}
    <div class="rotate-device-modal">
      <div class="rotate-card sekai-panel">
        <div class="rotate-anim-icon">📱 🔄</div>
        <h3 class="rotate-title">横画面推奨</h3>
        <p class="rotate-desc">
          このゲームはスマートフォンを<strong>横向き</strong>にして両手でプレイすることをお勧めします！
        </p>
        <p class="rotate-sub">端末を回転させてください</p>
      </div>
    </div>
  {/if}
</main>

<style>
  .app-viewport {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    position: relative;
    background: #070912;
  }

  /* 回転案内モーダル */
  .rotate-device-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(8, 10, 20, 0.88);
    backdrop-filter: blur(12px);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .rotate-card {
    text-align: center;
    padding: 28px 20px;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .rotate-anim-icon {
    font-size: 3.5rem;
    animation: rotateShake 2s infinite ease-in-out;
  }

  .rotate-title {
    font-family: var(--font-main);
    font-size: 1.35rem;
    font-weight: 900;
    color: var(--sekai-cyan);
  }

  .rotate-desc {
    font-size: 0.88rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.85);
  }

  .rotate-sub {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 600;
  }

  @keyframes rotateShake {
    0%, 100% { transform: rotate(0deg); }
    30% { transform: rotate(-30deg); }
    70% { transform: rotate(90deg); }
  }
</style>
