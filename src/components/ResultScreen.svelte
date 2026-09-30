<script lang="ts">
  import type { GameResult } from '../types';
  import { sound } from '../utils/audio';
  import { onMount } from 'svelte';

  interface Props {
    result: GameResult;
    onRetry: () => void;
    onSelectMusic: () => void;
  }

  const { result, onRetry, onSelectMusic }: Props = $props();

  onMount(() => {
    if (result.rank === 'SSS' || result.rank === 'SS' || result.rank === 'S') {
      sound.playHitSound('PERFECT');
      setTimeout(() => sound.playHitSound('PERFECT'), 150);
      setTimeout(() => sound.playHitSound('PERFECT'), 300);
    } else {
      sound.playHitSound('GREAT');
    }
  });

  function handleRetry() {
    sound.playHitSound('PERFECT');
    onRetry();
  }

  function handleSelect() {
    sound.playHitSound('GOOD');
    onSelectMusic();
  }
</script>

<div class="sekai-result-stage">
  <!-- ヘッダー -->
  <div class="result-header">
    <div class="header-left">
      <span class="live-success-badge">LIVE CLEAR</span>
    </div>
    <div class="song-meta-box">
      <span class="song-title">{result.song.title}</span>
      <span class="sekai-diff-tag diff-{result.difficulty}">{result.difficulty}</span>
    </div>
  </div>

  <div class="result-grid-layout">
    <!-- 左ペイン: ランク & トータルスコア & MAX COMBO -->
    <div class="score-card sekai-panel">
      {#if result.isNewRecord}
        <div class="new-record-ribbon">★ HIGH SCORE ★</div>
      {/if}

      <div class="rank-circle rank-{result.rank}">
        <span class="rank-char">{result.rank}</span>
      </div>

      <div class="score-value-block">
        <span class="score-label">SCORE</span>
        <span class="score-num">{result.score.toLocaleString()}</span>
      </div>

      <div class="combo-pill">
        <span class="combo-label">MAX COMBO:</span>
        <span class="combo-val {result.maxCombo === result.totalNotes ? 'full-combo' : ''}">
          {result.maxCombo} / {result.totalNotes}
        </span>
        {#if result.maxCombo === result.totalNotes}
          <span class="fc-badge">FULL COMBO!</span>
        {/if}
      </div>
    </div>

    <!-- 右ペイン: 判定内訳リスト & ボタン -->
    <div class="right-pane">
      <div class="judgments-table sekai-panel">
        <div class="judge-row perfect">
          <span class="j-badge">PERFECT</span>
          <span class="j-count">{result.counts.PERFECT}</span>
        </div>
        <div class="judge-row great">
          <span class="j-badge">GREAT</span>
          <span class="j-count">{result.counts.GREAT}</span>
        </div>
        <div class="judge-row good">
          <span class="j-badge">GOOD</span>
          <span class="j-count">{result.counts.GOOD}</span>
        </div>
        <div class="judge-row bad">
          <span class="j-badge">BAD</span>
          <span class="j-count">{result.counts.BAD}</span>
        </div>
        <div class="judge-row miss">
          <span class="j-badge">MISS</span>
          <span class="j-count">{result.counts.MISS}</span>
        </div>
      </div>

      <!-- アクションボタン -->
      <div class="result-actions">
        <button class="btn-sekai-live retry-btn" onclick={handleRetry}>
          🔄 もう一度ライブ (RETRY)
        </button>
        <button class="btn-sekai-secondary select-btn" onclick={handleSelect}>
          🎵 楽曲選択へ (SELECT)
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .sekai-result-stage {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: radial-gradient(circle at 50% 25%, #18223c 0%, #0a0d18 100%);
    position: relative;
    max-width: 960px;
    margin: 0 auto;
    padding: 0 16px;
  }

  .result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1.5px solid rgba(255, 255, 255, 0.1);
  }

  .live-success-badge {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 1.25rem;
    color: var(--sekai-cyan);
    letter-spacing: 0.1em;
    text-shadow: 0 0 12px var(--sekai-cyan);
  }

  .song-meta-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .song-title {
    font-size: 0.95rem;
    font-weight: 800;
  }

  .sekai-diff-tag {
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 900;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .result-grid-layout {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1.25fr;
    gap: 16px;
    padding: 14px 0;
    align-items: center;
    overflow-y: auto;
  }

  .score-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 18px;
    position: relative;
    height: 100%;
  }

  .new-record-ribbon {
    position: absolute;
    top: 8px;
    right: 12px;
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 900;
    color: #ffd700;
    background: rgba(255, 215, 0, 0.2);
    border: 1px solid #ffd700;
    padding: 2px 8px;
    border-radius: 10px;
    animation: pulseGlow 1.5s infinite alternate;
  }

  .rank-circle {
    width: 85px;
    height: 85px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border: 3px solid currentColor;
    box-shadow: 0 0 24px currentColor;
    margin-bottom: 6px;
  }

  .rank-char {
    font-family: var(--font-display);
    font-size: 3rem;
    font-weight: 900;
    line-height: 1;
  }

  .rank-SSS { color: #ffd700; }
  .rank-SS { color: #ff3377; }
  .rank-S { color: #33ccbb; }
  .rank-A { color: #33dd77; }
  .rank-B { color: #3399ff; }
  .rank-C { color: #aaa; }
  .rank-D { color: #666; }

  .score-value-block {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .score-label {
    font-family: var(--font-display);
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.1em;
  }

  .score-num {
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 900;
    color: #ffffff;
    text-shadow: 0 0 10px rgba(51, 204, 187, 0.6);
  }

  .combo-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 0.85rem;
  }

  .combo-label {
    color: rgba(255, 255, 255, 0.6);
    font-family: var(--font-display);
    font-size: 0.72rem;
  }

  .combo-val {
    font-family: var(--font-display);
    font-weight: 900;
  }

  .combo-val.full-combo {
    color: #ffd700;
  }

  .fc-badge {
    font-family: var(--font-display);
    font-size: 0.62rem;
    font-weight: 900;
    color: #ffd700;
    background: rgba(255, 215, 0, 0.2);
    border: 1px solid #ffd700;
    padding: 1px 6px;
    border-radius: 4px;
  }

  .right-pane {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    justify-content: center;
  }

  .judgments-table {
    padding: 12px 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .judge-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .judge-row:last-child {
    border-bottom: none;
  }

  .j-badge {
    font-family: var(--font-display);
    font-size: 0.82rem;
    font-weight: 900;
  }

  .judge-row.perfect .j-badge { color: #ffd700; text-shadow: 0 0 8px rgba(255, 215, 0, 0.8); }
  .judge-row.great .j-badge { color: #ff3377; }
  .judge-row.good .j-badge { color: #33dd77; }
  .judge-row.bad .j-badge { color: #aa33ff; }
  .judge-row.miss .j-badge { color: #8899aa; }

  .j-count {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 900;
  }

  .result-actions {
    display: flex;
    gap: 10px;
  }

  .retry-btn {
    flex: 1.3;
    padding: 12px;
    font-size: 1rem;
  }

  .select-btn {
    flex: 1;
    padding: 12px;
    font-size: 0.9rem;
  }

  @media (max-width: 640px) {
    .result-grid-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
