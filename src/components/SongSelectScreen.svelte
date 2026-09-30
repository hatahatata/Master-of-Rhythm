<script lang="ts">
  import type { Song, Difficulty, SongHighScore } from '../types';
  import { SONGS } from '../data/songs';
  import { sound } from '../utils/audio';
  import { getHighScore } from '../utils/storage';
  import { onDestroy, onMount } from 'svelte';

  interface Props {
    onSelect: (song: Song, difficulty: Difficulty) => void;
    onBack: () => void;
  }

  const { onSelect, onBack }: Props = $props();

  let selectedIndex = $state(0);
  let selectedDiff = $state<Difficulty>('NORMAL');
  let isPreviewing = $state(false);

  const currentSong = $derived(SONGS[selectedIndex]);
  const currentChart = $derived(currentSong.charts[selectedDiff]);
  const highScore = $derived<SongHighScore | null>(getHighScore(currentSong.id, selectedDiff));

  const difficulties: { key: Difficulty; label: string }[] = [
    { key: 'EASY', label: 'EASY' },
    { key: 'NORMAL', label: 'NORMAL' },
    { key: 'HARD', label: 'HARD' },
    { key: 'EXPERT', label: 'EXPERT' },
    { key: 'MASTER', label: 'MASTER' },
  ];

  onMount(() => {
    playPreview();
  });

  onDestroy(() => {
    sound.stopPreview();
  });

  function playPreview() {
    try {
      sound.playPreview(currentSong.audioSrc, currentSong.previewStart, currentSong.previewDuration);
      isPreviewing = true;
    } catch {
      // Audio context unlock
    }
  }

  function handlePrev() {
    selectedIndex = (selectedIndex - 1 + SONGS.length) % SONGS.length;
    sound.playHitSound('GOOD');
    playPreview();
  }

  function handleNext() {
    selectedIndex = (selectedIndex + 1) % SONGS.length;
    sound.playHitSound('GOOD');
    playPreview();
  }

  function selectDifficulty(diff: Difficulty) {
    selectedDiff = diff;
    sound.playHitSound('PERFECT');
  }

  function handleStartGame() {
    sound.init();
    sound.stopPreview();
    sound.playHitSound('PERFECT');
    onSelect(currentSong, selectedDiff);
  }

  function handleBack() {
    sound.stopPreview();
    sound.playHitSound('GOOD');
    onBack();
  }
</script>

<div class="sekai-select-container">
  <!-- プロセカ風ヘッダー -->
  <div class="sekai-header">
    <button class="btn-sekai-secondary back-btn" onclick={handleBack}>
      ◀ タイトルへ
    </button>
    <div class="header-title-box">
      <span class="sub-header">MUSIC SELECT</span>
      <h2 class="main-header">楽曲選択</h2>
    </div>
    <div class="device-badge">📱 横画面プレイ推奨</div>
  </div>

  <div class="sekai-select-body">
    <!-- 左ペイン: ジャケット & 楽曲情報 -->
    <div class="left-pane sekai-panel">
      <div class="jacket-carousel">
        <button class="arrow-btn left" onclick={handlePrev} aria-label="Previous Song">◀</button>
        
        <div class="sekai-jacket-frame" style="background: {currentSong.jacketColor}">
          <div class="jacket-glass">
            <span class="bpm-tag">BPM {currentSong.bpm}</span>
            <div class="song-title-large">{currentSong.title}</div>
            <div class="artist-name">{currentSong.artist}</div>
          </div>
        </div>

        <button class="arrow-btn right" onclick={handleNext} aria-label="Next Song">▶</button>
      </div>

      <!-- プロセカ風インジケーター -->
      <div class="song-dots">
        {#each SONGS as _, idx}
          <div class="dot {selectedIndex === idx ? 'active' : ''}"></div>
        {/each}
      </div>

      <div class="song-details-card">
        <h3 class="current-title">{currentSong.title}</h3>
        <p class="current-artist">作詞・作曲: {currentSong.artist}</p>
      </div>
    </div>

    <!-- 右ペイン: プロセカ風 難易度タブ & ハイスコア & ライブスタート -->
    <div class="right-pane">
      <!-- 難易度タブ (5段階カラー) -->
      <div class="sekai-diff-tabs">
        {#each difficulties as diff}
          {@const chart = currentSong.charts[diff.key]}
          <button 
            class="diff-card diff-{diff.key} {selectedDiff === diff.key ? 'active' : ''}" 
            onclick={() => selectDifficulty(diff.key)}
          >
            <span class="diff-title">{diff.label}</span>
            <span class="diff-level">Lv.{chart.level}</span>
          </button>
        {/each}
      </div>

      <!-- 譜面詳細 & ハイスコアパネル -->
      <div class="chart-stats sekai-panel">
        <div class="stat-columns">
          <div class="stat-item">
            <span class="stat-label">NOTES</span>
            <span class="stat-val">{currentChart.notes.length}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">LANES</span>
            <span class="stat-val cyan-highlight">6 LANES</span>
          </div>
        </div>

        <!-- ハイスコアエリア -->
        <div class="highscore-strip">
          <span class="high-label">HIGH SCORE</span>
          {#if highScore}
            <div class="high-content">
              <span class="rank-tag rank-{highScore.rank}">{highScore.rank}</span>
              <span class="score-digits">{highScore.score.toLocaleString()}</span>
              <span class="max-combo-tag">MAX {highScore.maxCombo} C</span>
            </div>
          {:else}
            <span class="no-record">NO RECORD</span>
          {/if}
        </div>
      </div>

      <!-- プロセカ風 ライブスタートボタン -->
      <button class="btn-sekai-live live-start-btn" onclick={handleStartGame}>
        <div class="live-btn-inner">
          <span class="live-icon">▶</span>
          <span class="live-text">ライブスタート</span>
        </div>
      </button>
    </div>
  </div>
</div>

<style>
  .sekai-select-container {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: radial-gradient(circle at 50% 25%, #18223c 0%, #0a0d18 100%);
    position: relative;
    max-width: 980px;
    margin: 0 auto;
    padding: 0 16px;
  }

  .sekai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1.5px solid rgba(255, 255, 255, 0.1);
  }

  .back-btn {
    font-size: 0.85rem;
    padding: 6px 14px;
  }

  .header-title-box {
    text-align: center;
  }

  .sub-header {
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    color: var(--sekai-cyan);
    font-weight: 800;
  }

  .main-header {
    font-size: 1.15rem;
    font-weight: 900;
    line-height: 1.1;
  }

  .device-badge {
    font-size: 0.72rem;
    color: var(--sekai-cyan);
    background: rgba(51, 204, 187, 0.12);
    border: 1px solid rgba(51, 204, 187, 0.35);
    padding: 4px 10px;
    border-radius: 12px;
  }

  .sekai-select-body {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1.35fr;
    gap: 16px;
    padding: 12px 0;
    align-items: center;
    overflow-y: auto;
  }

  .left-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    height: 100%;
  }

  .jacket-carousel {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
  }

  .arrow-btn {
    background: rgba(30, 42, 70, 0.9);
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    color: #ffffff;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .arrow-btn:active {
    transform: scale(0.9);
    background: var(--sekai-cyan);
    color: #000;
  }

  .sekai-jacket-frame {
    width: 140px;
    height: 140px;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 51, 119, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .jacket-glass {
    width: 100%;
    height: 100%;
    background: rgba(12, 16, 30, 0.8);
    backdrop-filter: blur(8px);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .bpm-tag {
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 800;
    color: var(--sekai-cyan);
    margin-bottom: 2px;
  }

  .song-title-large {
    font-family: var(--font-main);
    font-weight: 900;
    font-size: 0.95rem;
    line-height: 1.2;
    color: #ffffff;
    margin-bottom: 2px;
  }

  .artist-name {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .song-dots {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    transition: all 0.2s;
  }

  .dot.active {
    width: 20px;
    border-radius: 4px;
    background: var(--sekai-cyan);
    box-shadow: 0 0 8px var(--sekai-cyan);
  }

  .song-details-card {
    text-align: center;
    margin-top: 6px;
  }

  .current-title {
    font-size: 1.15rem;
    font-weight: 900;
  }

  .current-artist {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  /* 右ペイン */
  .right-pane {
    display: flex;
    flex-direction: column;
    gap: 12px;
    justify-content: center;
    height: 100%;
  }

  /* 難易度タブ (プロセカ風5色) */
  .sekai-diff-tabs {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .diff-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 2px;
    border-radius: 12px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .diff-title {
    font-family: var(--font-display);
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .diff-level {
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: 900;
    margin-top: 2px;
  }

  .diff-card.active {
    transform: translateY(-3px) scale(1.03);
    border-color: #ffffff;
    box-shadow: 0 4px 16px rgba(255, 255, 255, 0.4);
  }

  /* 譜面統計パネル */
  .chart-stats {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .stat-columns {
    display: flex;
    justify-content: space-around;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-label {
    font-size: 0.65rem;
    font-family: var(--font-display);
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.08em;
  }

  .stat-val {
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 900;
  }

  .cyan-highlight {
    color: var(--sekai-cyan);
  }

  .highscore-strip {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .high-label {
    font-size: 0.62rem;
    font-family: var(--font-display);
    color: var(--sekai-yellow);
    letter-spacing: 0.1em;
  }

  .high-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rank-tag {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 0.95rem;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
  }

  .rank-SSS { color: #ffd700; text-shadow: 0 0 10px #ffd700; }
  .rank-SS { color: #ff3377; text-shadow: 0 0 10px #ff3377; }
  .rank-S { color: #33ccbb; text-shadow: 0 0 10px #33ccbb; }
  .rank-A { color: #33dd77; }
  .rank-B { color: #3399ff; }
  .rank-C { color: #aaa; }
  .rank-D { color: #666; }

  .score-digits {
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 900;
  }

  .max-combo-tag {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .no-record {
    font-size: 0.75rem;
    font-family: var(--font-display);
    color: rgba(255, 255, 255, 0.35);
  }

  /* ライブスタートボタン (プロセカ風) */
  .live-start-btn {
    width: 100%;
    padding: 14px;
  }

  .live-btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .live-icon {
    font-size: 1rem;
  }

  .live-text {
    font-size: 1.2rem;
    letter-spacing: 0.08em;
  }

  @media (max-width: 640px) {
    .sekai-select-body {
      grid-template-columns: 1fr;
    }
  }
</style>
