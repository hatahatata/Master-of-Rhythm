<script lang="ts">
  import type { GameSettings } from '../types';
  import { sound } from '../utils/audio';
  import { saveSettings } from '../utils/storage';
  import { onMount } from 'svelte';

  interface Props {
    settings: GameSettings;
    onBack: (newSettings: GameSettings) => void;
  }

  const { settings, onBack }: Props = $props();

  let bgmVolume = $state(0.8);
  let seVolume = $state(0.9);
  let noteSpeed = $state(5.0);
  let offsetMs = $state(0);
  let keyBindings = $state<string[]>(['s', 'd', 'f', 'j', 'k', 'l']);

  let activeKeyIndex = $state<number | null>(null);

  onMount(() => {
    bgmVolume = settings.bgmVolume;
    seVolume = settings.seVolume;
    noteSpeed = settings.noteSpeed;
    offsetMs = settings.offsetMs;
    keyBindings = [...settings.keyBindings];
  });

  function handleSaveAndBack() {
    const updated: GameSettings = {
      bgmVolume,
      seVolume,
      noteSpeed,
      offsetMs,
      keyBindings,
    };
    saveSettings(updated);
    sound.setVolumes(bgmVolume, seVolume);
    sound.playHitSound('GOOD');
    onBack(updated);
  }

  function handleVolumeChange() {
    sound.setVolumes(bgmVolume, seVolume);
  }

  function testSound(type: 'PERFECT' | 'GREAT' | 'GOOD' | 'BAD' | 'MISS') {
    sound.setVolumes(bgmVolume, seVolume);
    sound.playHitSound(type);
  }

  function startKeyBind(index: number) {
    activeKeyIndex = index;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (activeKeyIndex !== null) {
      e.preventDefault();
      const key = e.key.toLowerCase();
      keyBindings[activeKeyIndex] = key;
      activeKeyIndex = null;
      sound.playHitSound('PERFECT');
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="settings-container">
  <div class="header">
    <button class="back-btn" onclick={handleSaveAndBack}>
      ◀ BACK
    </button>
    <h2 class="title">SETTINGS</h2>
    <div class="placeholder"></div>
  </div>

  <div class="scroll-body landscape-grid">
    <!-- 左カラム: 音量設定 & SEテスト -->
    <div class="section glass-panel">
      <h3 class="section-title">🔊 音量設定 (VOLUME)</h3>
      
      <div class="setting-row">
        <div class="label-row">
          <span>BGM 音量</span>
          <span class="value">{Math.round(bgmVolume * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.05" 
          bind:value={bgmVolume} 
          oninput={handleVolumeChange} 
        />
      </div>

      <div class="setting-row">
        <div class="label-row">
          <span>SE 音量 (タップ音)</span>
          <span class="value">{Math.round(seVolume * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.05" 
          bind:value={seVolume} 
          oninput={handleVolumeChange} 
        />
      </div>

      <div class="sound-test-row">
        <span>SEテスト:</span>
        <button class="test-btn perfect" onclick={() => testSound('PERFECT')}>PERFECT</button>
        <button class="test-btn great" onclick={() => testSound('GREAT')}>GREAT</button>
        <button class="test-btn good" onclick={() => testSound('GOOD')}>GOOD</button>
      </div>
    </div>

    <!-- 右カラム: ノーツ速度 & タイミング調整 & キーバインド -->
    <div class="right-column-sections">
      <div class="section glass-panel">
        <h3 class="section-title">⚡ プレイ設定 (GAMEPLAY)</h3>

        <div class="setting-row">
          <div class="label-row">
            <span>ノーツ落下速度 (SPEED)</span>
            <span class="value speed-val">x{noteSpeed.toFixed(1)}</span>
          </div>
          <div class="stepper-row">
            <button class="step-btn" onclick={() => noteSpeed = Math.max(1.0, +(noteSpeed - 0.2).toFixed(1))}>-</button>
            <input 
              type="range" 
              min="1.0" 
              max="10.0" 
              step="0.1" 
              bind:value={noteSpeed} 
            />
            <button class="step-btn" onclick={() => noteSpeed = Math.min(10.0, +(noteSpeed + 0.2).toFixed(1))}>+</button>
          </div>
        </div>

        <div class="setting-row">
          <div class="label-row">
            <span>判定タイミング調整 (OFFSET)</span>
            <span class="value offset-val">{offsetMs > 0 ? `+${offsetMs}` : offsetMs} ms</span>
          </div>
          <div class="stepper-row">
            <button class="step-btn" onclick={() => offsetMs = Math.max(-200, offsetMs - 5)}>-5ms</button>
            <input 
              type="range" 
              min="-200" 
              max="200" 
              step="5" 
              bind:value={offsetMs} 
            />
            <button class="step-btn" onclick={() => offsetMs = Math.min(200, offsetMs + 5)}>+5ms</button>
          </div>
        </div>
      </div>

      <!-- PC キーボード設定 -->
      <div class="section glass-panel">
        <h3 class="section-title">⌨ PCキーバインド (6レーン)</h3>
        <div class="key-grid">
          {#each keyBindings as key, i}
            <button 
              class="key-box {activeKeyIndex === i ? 'active' : ''}" 
              onclick={() => startKeyBind(i)}
            >
              <span class="lane-num">L{i + 1}</span>
              <span class="key-char">{activeKeyIndex === i ? 'PRESS' : key.toUpperCase()}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <button class="btn-primary save-btn" onclick={handleSaveAndBack}>
      設定を保存して戻る (SAVE & BACK)
    </button>
  </div>
</div>

<style>
  .settings-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #07080f;
    color: #ffffff;
    max-width: 900px;
    position: relative;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    border-bottom: 1px solid var(--border-glass);
    background: rgba(14, 16, 28, 0.95);
  }

  .back-btn {
    background: transparent;
    border: none;
    color: var(--accent-cyan);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
  }

  .back-btn:active {
    background: rgba(0, 242, 254, 0.15);
  }

  .title {
    font-family: var(--font-display);
    font-size: 1.15rem;
    letter-spacing: 0.1em;
  }

  .placeholder {
    width: 60px;
  }

  .scroll-body {
    flex: 1;
    overflow-y: auto;
    padding: 14px 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    align-items: start;
  }

  .right-column-sections {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-size: 0.88rem;
    font-family: var(--font-display);
    color: var(--accent-cyan);
    letter-spacing: 0.08em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 6px;
  }

  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .value {
    font-family: var(--font-display);
    color: var(--accent-cyan);
    font-weight: 700;
  }

  .speed-val {
    color: var(--accent-pink);
    font-size: 1rem;
  }

  .offset-val {
    color: var(--accent-yellow);
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--accent-cyan);
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    outline: none;
  }

  .stepper-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step-btn {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid var(--border-glass);
    color: #ffffff;
    padding: 4px 10px;
    font-family: var(--font-display);
    font-size: 0.8rem;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }

  .step-btn:active {
    background: var(--accent-cyan);
    color: #000;
  }

  .sound-test-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    margin-top: 4px;
  }

  .test-btn {
    padding: 5px 8px;
    border-radius: 6px;
    border: none;
    font-size: 0.72rem;
    font-family: var(--font-display);
    font-weight: 700;
    cursor: pointer;
  }

  .test-btn.perfect {
    background: #ffd700;
    color: #000;
  }

  .test-btn.great {
    background: #ff007f;
    color: #fff;
  }

  .test-btn.good {
    background: #00f2fe;
    color: #000;
  }

  .key-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
  }

  .key-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 2px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid var(--border-glass);
    border-radius: 6px;
    color: #ffffff;
    cursor: pointer;
    transition: all 0.15s;
  }

  .key-box.active {
    border-color: var(--accent-pink);
    background: rgba(255, 0, 127, 0.2);
  }

  .lane-num {
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .key-char {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 0.95rem;
    color: var(--accent-cyan);
    margin-top: 1px;
  }

  .footer {
    padding: 10px 16px;
    border-top: 1px solid var(--border-glass);
    background: rgba(14, 16, 28, 0.95);
  }

  .save-btn {
    width: 100%;
    padding: 12px;
    font-size: 0.95rem;
  }

  @media (max-width: 640px) {
    .scroll-body {
      grid-template-columns: 1fr;
    }
  }
</style>
