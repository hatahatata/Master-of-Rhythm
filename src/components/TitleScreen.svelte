<script lang="ts">
  import { sound } from '../utils/audio';

  interface Props {
    onStart: () => void;
    onSettings: () => void;
  }

  const { onStart, onSettings }: Props = $props();

  function handleStart() {
    sound.init();
    sound.playHitSound('PERFECT');
    onStart();
  }

  function handleSettings() {
    sound.init();
    sound.playHitSound('GOOD');
    onSettings();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
</script>

<div class="sekai-title-container">
  <!-- プロセカ風 幾何学背景 -->
  <div class="sekai-bg-decor">
    <div class="sekai-triangle triangle-1"></div>
    <div class="sekai-triangle triangle-2"></div>
  </div>

  <button class="fullscreen-btn" onclick={toggleFullscreen} title="Toggle Fullscreen">
    ⛶ 全画面
  </button>

  <div class="title-content">
    <div class="logo-box">
      <div class="device-pill">
        <span class="icon">📱 🔄</span> スマートフォン横画面プレイ推奨
      </div>
      <h1 class="sekai-main-logo">
        <span class="logo-cyber">PROJECT</span>
        <span class="logo-beat">BEAT</span>
      </h1>
      <p class="logo-sub">FEAT. 6-LANE RHYTHM STAGE</p>
    </div>

    <!-- アクションボタン -->
    <div class="actions-box">
      <button class="btn-sekai-live start-btn" onclick={handleStart}>
        <span class="icon">▶</span> GAME START
      </button>

      <button class="btn-sekai-secondary settings-btn" onclick={handleSettings}>
        <span>⚙</span> SETTINGS
      </button>
    </div>

    <div class="title-footer">
      <p>Music provided by 魔王魂 (MaouDamashii)</p>
      <p class="hint-text">📱 スマホを横向きにしてプレイしてください / PC: [S D F J K L] Supported</p>
    </div>
  </div>
</div>

<style>
  .sekai-title-container {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: radial-gradient(circle at 50% 25%, #18223c 0%, #0a0d18 100%);
  }

  .fullscreen-btn {
    position: absolute;
    top: 14px;
    right: 18px;
    background: rgba(30, 42, 70, 0.85);
    border: 1.5px solid rgba(255, 255, 255, 0.25);
    color: #ffffff;
    padding: 6px 14px;
    border-radius: 16px;
    font-size: 0.75rem;
    font-family: var(--font-main);
    cursor: pointer;
    z-index: 50;
    backdrop-filter: blur(8px);
  }

  .fullscreen-btn:active {
    background: var(--sekai-cyan);
    color: #000;
  }

  .title-content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    padding: 20px;
    width: 100%;
    max-width: 820px;
  }

  .logo-box {
    text-align: center;
    margin-top: 12px;
  }

  .device-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    font-size: 0.75rem;
    font-family: var(--font-main);
    font-weight: 700;
    color: var(--sekai-cyan);
    background: rgba(51, 204, 187, 0.15);
    border: 1.5px solid rgba(51, 204, 187, 0.4);
    border-radius: 20px;
    margin-bottom: 12px;
    backdrop-filter: blur(8px);
  }

  .sekai-main-logo {
    font-family: var(--font-display);
    font-size: 3.6rem;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.08em;
  }

  .logo-cyber {
    background: linear-gradient(180deg, #ffffff 0%, #33ccbb 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 16px rgba(51, 204, 187, 0.7));
  }

  .logo-beat {
    background: linear-gradient(180deg, #ffffff 0%, #ff3377 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 16px rgba(255, 51, 119, 0.8));
    margin-left: 6px;
  }

  .logo-sub {
    font-size: 0.8rem;
    letter-spacing: 0.25em;
    color: rgba(255, 255, 255, 0.75);
    font-family: var(--font-display);
    font-weight: 700;
    margin-top: 6px;
  }

  .actions-box {
    display: flex;
    gap: 16px;
    width: 100%;
    max-width: 440px;
    justify-content: center;
  }

  .start-btn {
    flex: 1.4;
    padding: 14px 24px;
    font-size: 1.15rem;
  }

  .settings-btn {
    flex: 1;
    padding: 14px 20px;
    font-size: 0.95rem;
  }

  .title-footer {
    text-align: center;
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.45);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .hint-text {
    color: var(--sekai-cyan);
    font-weight: 600;
    opacity: 0.9;
  }

  @media (max-height: 480px) {
    .title-content {
      padding: 10px 16px;
    }
    .sekai-main-logo {
      font-size: 2.6rem;
    }
    .device-pill {
      margin-bottom: 6px;
      font-size: 0.68rem;
    }
    .start-btn, .settings-btn {
      padding: 10px 16px;
      font-size: 0.95rem;
    }
  }
</style>
