<script lang="ts">
  import type { Song, Difficulty, GameSettings, GameResult, Note, JudgmentType } from '../types';
  import { sound } from '../utils/audio';
  import { saveHighScore } from '../utils/storage';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    song: Song;
    difficulty: Difficulty;
    settings: GameSettings;
    onFinish: (result: GameResult) => void;
    onQuit: () => void;
  }

  const props: Props = $props();

  const chart = $derived(props.song.charts[props.difficulty]);
  const totalNotes = $derived(chart.notes.length);

  // ゲーム状態
  let isPaused = $state(false);
  let isReady = $state(false);
  let countdownText = $state<string | null>('3');
  let countdownNum = $state(3);

  let currentScore = $state(0);
  let currentCombo = $state(0);
  let maxCombo = $state(0);
  let currentLife = $state(1000);
  let progressPercent = $state(0);

  // 判定カウント
  let counts = $state<Record<JudgmentType, number>>({
    PERFECT: 0,
    GREAT: 0,
    GOOD: 0,
    BAD: 0,
    MISS: 0,
  });

  let currentJudgment = $state<JudgmentType | null>(null);
  let judgmentKey = $state(0);

  // 6レーンの押下状態
  let activeLanes = $state<boolean[]>([false, false, false, false, false, false]);

  // Canvas
  let canvasEl: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;

  // ノーツランタイム管理
  let notes: Note[] = [];

  // ポインター追跡
  const pointerLaneMap = new Map<number, number>();
  const holdingNotes = new Map<number, Note>();

  // タップエフェクト (Canvas描画用)
  interface TapParticle {
    lane: number;
    startTime: number;
    color: string;
  }
  let tapParticles: TapParticle[] = [];

  let animFrameId: number | null = null;
  let isGameStarted = false;
  let isEnded = false;

  // 判定定数 (秒)
  const JUDGE_PERFECT = 0.050; // 50ms
  const JUDGE_GREAT = 0.100;   // 100ms
  const JUDGE_GOOD = 0.150;    // 150ms
  const JUDGE_BAD = 0.250;     // 250ms
  const JUDGE_MISS_THRESHOLD = 0.250;

  // 落下秒数
  const fallDuration = $derived(1.8 / (props.settings.noteSpeed * 0.48));

  // プロセカ風 カラー定数
  const LANE_COLORS = [
    { base: '#ff3377', glow: 'rgba(255, 51, 119, 0.6)' },
    { base: '#33ccbb', glow: 'rgba(51, 204, 187, 0.6)' },
    { base: '#ffcc00', glow: 'rgba(255, 204, 0, 0.6)' },
    { base: '#ffcc00', glow: 'rgba(255, 204, 0, 0.6)' },
    { base: '#33ccbb', glow: 'rgba(51, 204, 187, 0.6)' },
    { base: '#ff3377', glow: 'rgba(255, 51, 119, 0.6)' },
  ];

  onMount(async () => {
    notes = chart.notes.map(n => ({
      ...n,
      state: 'idle',
      holdProgress: 0,
      scoreGiven: false,
    }));

    if (canvasEl) {
      ctx = canvasEl.getContext('2d');
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
    }

    try {
      sound.init();
      await sound.prepareBgm(props.song.audioSrc);
    } catch (e) {
      console.warn('Audio preloading warning:', e);
    }

    isReady = true;
    startCountdown();
  });

  onDestroy(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    window.removeEventListener('resize', resizeCanvas);
    sound.stopBgm();
  });

  function resizeCanvas() {
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    canvasEl.width = rect.width * window.devicePixelRatio;
    canvasEl.height = rect.height * window.devicePixelRatio;
  }

  // カウントダウン開始
  function startCountdown() {
    countdownNum = 3;
    countdownText = '3';
    sound.playCountdown(3);

    const interval = setInterval(() => {
      countdownNum--;
      if (countdownNum === 2) {
        countdownText = '2';
        sound.playCountdown(2);
      } else if (countdownNum === 1) {
        countdownText = '1';
        sound.playCountdown(1);
      } else if (countdownNum === 0) {
        countdownText = 'START';
        sound.playCountdown(0);
      } else {
        clearInterval(interval);
        countdownText = null;
        startGameplay();
      }
    }, 700);
  }

  function startGameplay() {
    isGameStarted = true;
    sound.playBgm(0);
    gameLoop();
  }

  // メインゲームループ (rAF)
  function gameLoop() {
    if (!isPaused && isGameStarted && !isEnded) {
      const musicTime = sound.getCurrentTime();
      const effectiveTime = musicTime + (props.settings.offsetMs / 1000);
      const songDuration = sound.getDuration() || 1;
      progressPercent = Math.min(100, (musicTime / songDuration) * 100);

      // 1. ノーツ判定 & ロングノーツ更新
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        if (note.state === 'idle') {
          if (effectiveTime > note.time + JUDGE_MISS_THRESHOLD) {
            registerHit('MISS', note);
          }
        } else if (note.state === 'holding') {
          const holdEnd = note.time + (note.duration || 0);
          const elapsed = effectiveTime - note.time;
          const totalDur = note.duration || 0.1;
          note.holdProgress = Math.min(1.0, Math.max(0, elapsed / totalDur));

          if (Math.random() < 0.25) {
            sound.playHitSound('HOLD');
            triggerTapParticle(note.lane);
          }

          if (effectiveTime >= holdEnd) {
            registerHit('PERFECT', note, true);
          }
        }
      }

      // 2. Canvas 3D プロセカ描画
      renderCanvas(effectiveTime);

      // 3. 終了判定
      const duration = sound.getDuration();
      const allNotesHandled = notes.every(n => n.state === 'hit' || n.state === 'miss');
      
      if ((duration > 0 && musicTime >= duration + 0.5) || (allNotesHandled && musicTime > (notes[notes.length - 1]?.time || 0) + 1.8)) {
        endGame();
        return;
      }
    }

    animFrameId = requestAnimationFrame(gameLoop);
  }

  function triggerTapParticle(lane: number) {
    tapParticles.push({
      lane,
      startTime: performance.now(),
      color: LANE_COLORS[lane].base,
    });
    if (tapParticles.length > 20) tapParticles.shift();
  }

  // ==========================================
  // プロセカ風 3D パースペクティブ Canvas 描画エンジン
  // ==========================================
  function renderCanvas(effectiveTime: number) {
    if (!ctx || !canvasEl) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvasEl.width;
    const H = canvasEl.height;

    ctx.clearRect(0, 0, W, H);

    // 3D 座標変換パラメータ
    const W_top = W * 0.52;      // 奥の幅
    const W_bottom = W * 0.94;   // 手前の幅
    const Y_top = H * 0.06;      // 奥のY
    const Y_bottom = H * 0.82;   // 判定ラインのY

    const X_top_start = (W - W_top) / 2;
    const X_bottom_start = (W - W_bottom) / 2;

    const w_top_lane = W_top / 6;
    const w_bottom_lane = W_bottom / 6;

    // 進捗 t (0.0=奥, 1.0=判定ライン) におけるレーンの左右座標取得
    const getLanePos = (lane: number, t: number) => {
      const clampedT = Math.max(0, Math.min(1.2, t));
      // 3D遠近法イージング
      const easedT = Math.pow(clampedT, 1.35);

      const y = Y_top + easedT * (Y_bottom - Y_top);
      const curXStart = X_top_start * (1 - easedT) + X_bottom_start * easedT;
      const curLaneWidth = w_top_lane * (1 - easedT) + w_bottom_lane * easedT;
      const x = curXStart + lane * curLaneWidth;

      return { x, y, width: curLaneWidth, t: easedT };
    };

    // --- 1. 3D レーン床面の描画 ---
    for (let i = 0; i < 6; i++) {
      const topL = { x: X_top_start + i * w_top_lane, y: Y_top };
      const topR = { x: X_top_start + (i + 1) * w_top_lane, y: Y_top };
      const botL = { x: X_bottom_start + i * w_bottom_lane, y: Y_bottom + 20 * dpr };
      const botR = { x: X_bottom_start + (i + 1) * w_bottom_lane, y: Y_bottom + 20 * dpr };

      ctx.beginPath();
      ctx.moveTo(topL.x, topL.y);
      ctx.lineTo(topR.x, topR.y);
      ctx.lineTo(botR.x, botR.y);
      ctx.lineTo(botL.x, botL.y);
      ctx.closePath();

      // レーン背景
      ctx.fillStyle = i % 2 === 0 ? 'rgba(18, 24, 48, 0.65)' : 'rgba(14, 20, 40, 0.65)';
      ctx.fill();

      // アクティブ時の光線ビーム
      if (activeLanes[i]) {
        const beamGrad = ctx.createLinearGradient(0, Y_top, 0, Y_bottom);
        beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        beamGrad.addColorStop(0.5, LANE_COLORS[i].glow);
        beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0.7)');
        ctx.fillStyle = beamGrad;
        ctx.fill();
      }

      // レーン境界線
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
    }

    // 外枠の光るガイドライン
    ctx.strokeStyle = 'rgba(51, 204, 187, 0.5)';
    ctx.lineWidth = 2.5 * dpr;
    ctx.beginPath();
    ctx.moveTo(X_top_start, Y_top);
    ctx.lineTo(X_bottom_start, Y_bottom + 20 * dpr);
    ctx.moveTo(X_top_start + W_top, Y_top);
    ctx.lineTo(X_bottom_start + W_bottom, Y_bottom + 20 * dpr);
    ctx.stroke();

    // --- 2. ロングノーツの帯 (リボン) 描画 ---
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.type !== 'long') continue;
      if (note.state !== 'idle' && note.state !== 'holding') continue;

      const timeToHead = note.time - effectiveTime;
      const duration = note.duration || 0.5;
      const timeToTail = (note.time + duration) - effectiveTime;

      if (timeToTail < 0 || timeToHead > fallDuration) continue;

      const headProgress = note.state === 'holding' ? 1.0 : (1.0 - timeToHead / fallDuration);
      const tailProgress = 1.0 - timeToTail / fallDuration;

      const segments = 12;
      const pStart = Math.max(0, tailProgress);
      const pEnd = Math.min(1.0, headProgress);

      if (pEnd > pStart) {
        ctx.beginPath();
        for (let s = 0; s <= segments; s++) {
          const segT = pStart + (s / segments) * (pEnd - pStart);
          const pos = getLanePos(note.lane, segT);
          if (s === 0) ctx.moveTo(pos.x + 3 * dpr, pos.y);
          else ctx.lineTo(pos.x + 3 * dpr, pos.y);
        }
        for (let s = segments; s >= 0; s--) {
          const segT = pStart + (s / segments) * (pEnd - pStart);
          const pos = getLanePos(note.lane, segT);
          ctx.lineTo(pos.x + pos.width - 3 * dpr, pos.y);
        }
        ctx.closePath();

        const ribbonGrad = ctx.createLinearGradient(0, Y_top, 0, Y_bottom);
        ribbonGrad.addColorStop(0, 'rgba(51, 204, 187, 0.35)');
        ribbonGrad.addColorStop(1, 'rgba(51, 204, 187, 0.85)');
        ctx.fillStyle = ribbonGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.stroke();
      }
    }

    // --- 3. 判定ライン (クリティカル・ネオンバー) 描画 ---
    ctx.shadowColor = 'rgba(51, 204, 187, 0.9)';
    ctx.shadowBlur = 16 * dpr;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(X_bottom_start - 10 * dpr, Y_bottom - 2 * dpr, W_bottom + 20 * dpr, 5 * dpr);
    ctx.shadowBlur = 0;

    // --- 4. ノーツ本体 (クリスタルカプセル) 描画 ---
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note.state !== 'idle' && note.state !== 'holding') continue;

      const timeToHit = note.time - effectiveTime;
      if (timeToHit > fallDuration || (note.type === 'normal' && timeToHit < -0.15)) continue;

      const progress = 1.0 - timeToHit / fallDuration;
      if (progress < 0 || progress > 1.15) continue;

      const pos = getLanePos(note.lane, progress);
      const noteHeight = (14 + pos.t * 12) * dpr;
      const noteW = pos.width - 6 * dpr;
      const noteX = pos.x + 3 * dpr;
      const noteY = pos.y - noteHeight / 2;

      // クリスタルノーツの描画
      ctx.save();
      const col = LANE_COLORS[note.lane];

      // 外枠発光
      ctx.shadowColor = col.base;
      ctx.shadowBlur = (8 + pos.t * 10) * dpr;

      // ノーツグラデーション
      const noteGrad = ctx.createLinearGradient(0, noteY, 0, noteY + noteHeight);
      noteGrad.addColorStop(0, '#ffffff');
      noteGrad.addColorStop(0.4, col.base);
      noteGrad.addColorStop(1, col.base);

      ctx.fillStyle = noteGrad;
      ctx.beginPath();
      const r = 5 * dpr;
      ctx.roundRect(noteX, noteY, noteW, noteHeight, [r, r, r, r]);
      ctx.fill();

      // 白熱ハイライト
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      ctx.restore();
    }

    // --- 5. タップショックウェーブ & スパーク描画 ---
    const now = performance.now();
    for (let i = tapParticles.length - 1; i >= 0; i--) {
      const p = tapParticles[i];
      const elapsed = (now - p.startTime) / 250; // 0.25秒でフェード
      if (elapsed >= 1.0) {
        tapParticles.splice(i, 1);
        continue;
      }

      const pos = getLanePos(p.lane, 1.0);
      const centerX = pos.x + pos.width / 2;
      const centerY = Y_bottom;
      const radius = (20 + elapsed * 45) * dpr;
      const alpha = 1.0 - elapsed;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius, radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.fill();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ノーツタップ/判定処理
  function handleLaneDown(lane: number) {
    if (!isGameStarted || isPaused || isEnded) return;
    activeLanes[lane] = true;
    triggerTapParticle(lane);

    const musicTime = sound.getCurrentTime();
    const effectiveTime = musicTime + (props.settings.offsetMs / 1000);

    const targetNote = notes.find(n => n.lane === lane && n.state === 'idle');
    if (!targetNote) {
      return;
    }

    const diff = Math.abs(effectiveTime - targetNote.time);

    if (diff <= JUDGE_BAD) {
      let judge: JudgmentType = 'MISS';
      if (diff <= JUDGE_PERFECT) judge = 'PERFECT';
      else if (diff <= JUDGE_GREAT) judge = 'GREAT';
      else if (diff <= JUDGE_GOOD) judge = 'GOOD';
      else judge = 'BAD';

      if (targetNote.type === 'long') {
        targetNote.state = 'holding';
        holdingNotes.set(lane, targetNote);
        registerHit(judge, targetNote, false, true);
      } else {
        registerHit(judge, targetNote);
      }
    }
  }

  function handleLaneUp(lane: number) {
    activeLanes[lane] = false;

    if (holdingNotes.has(lane)) {
      const note = holdingNotes.get(lane)!;
      holdingNotes.delete(lane);

      const musicTime = sound.getCurrentTime();
      const effectiveTime = musicTime + (props.settings.offsetMs / 1000);
      const holdEnd = note.time + (note.duration || 0);

      if (effectiveTime < holdEnd - JUDGE_BAD) {
        registerHit('BAD', note, true);
      } else {
        registerHit('PERFECT', note, true);
      }
    }
  }

  function registerHit(judge: JudgmentType, note: Note, isHoldEnd: boolean = false, isHoldStart: boolean = false) {
    if (isHoldStart) {
      sound.playHitSound(judge);
      currentJudgment = judge;
      judgmentKey++;
      return;
    }

    if (judge === 'MISS') {
      note.state = 'miss';
      currentLife = Math.max(0, currentLife - 80);
    } else {
      note.state = 'hit';
      if (judge === 'PERFECT' || judge === 'GREAT') {
        currentLife = Math.min(1000, currentLife + 10);
      } else if (judge === 'BAD') {
        currentLife = Math.max(0, currentLife - 40);
      }
    }

    counts[judge]++;
    sound.playHitSound(judge);

    if (judge === 'MISS') {
      currentCombo = 0;
    } else {
      currentCombo++;
      if (currentCombo > maxCombo) {
        maxCombo = currentCombo;
      }
    }

    const baseScore = 1000000 / totalNotes;
    let multiplier = 0;
    if (judge === 'PERFECT') multiplier = 1.0;
    else if (judge === 'GREAT') multiplier = 0.8;
    else if (judge === 'GOOD') multiplier = 0.5;
    else if (judge === 'BAD') multiplier = 0.2;

    currentScore = Math.min(1000000, Math.round(currentScore + baseScore * multiplier));
    currentJudgment = judge;
    judgmentKey++;
  }

  function endGame() {
    if (isEnded) return;
    isEnded = true;
    sound.stopBgm();

    let rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' = 'D';
    if (currentScore >= 980000) rank = 'SSS';
    else if (currentScore >= 950000) rank = 'SS';
    else if (currentScore >= 900000) rank = 'S';
    else if (currentScore >= 800000) rank = 'A';
    else if (currentScore >= 700000) rank = 'B';
    else if (currentScore >= 600000) rank = 'C';

    const isNew = saveHighScore(props.song.id, props.difficulty, {
      score: currentScore,
      rank,
      maxCombo,
      cleared: true,
    });

    const result: GameResult = {
      song: props.song,
      difficulty: props.difficulty,
      score: currentScore,
      maxScore: 1000000,
      maxCombo,
      totalNotes,
      counts: { ...counts },
      rank,
      isNewRecord: isNew,
    };

    setTimeout(() => {
      props.onFinish(result);
    }, 1000);
  }

  function handlePause() {
    if (!isGameStarted || isEnded || isPaused) return;
    isPaused = true;
    sound.pauseBgm();
  }

  function handleResume() {
    isPaused = false;
    sound.resumeBgm();
    gameLoop();
  }

  function handleRetry() {
    sound.stopBgm();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    notes = chart.notes.map(n => ({ ...n, state: 'idle', holdProgress: 0 }));
    currentScore = 0;
    currentCombo = 0;
    maxCombo = 0;
    currentLife = 1000;
    counts = { PERFECT: 0, GREAT: 0, GOOD: 0, BAD: 0, MISS: 0 };
    currentJudgment = null;
    isPaused = false;
    isEnded = false;
    startCountdown();
  }

  function handleQuitGame() {
    sound.stopBgm();
    if (animFrameId) cancelAnimationFrame(animFrameId);
    props.onQuit();
  }

  function handlePointerDown(e: PointerEvent, lane: number) {
    e.preventDefault();
    pointerLaneMap.set(e.pointerId, lane);
    handleLaneDown(lane);
  }

  function handlePointerUp(e: PointerEvent) {
    e.preventDefault();
    if (pointerLaneMap.has(e.pointerId)) {
      const lane = pointerLaneMap.get(e.pointerId)!;
      pointerLaneMap.delete(e.pointerId);
      handleLaneUp(lane);
    }
  }

  function handlePointerCancel(e: PointerEvent) {
    handlePointerUp(e);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    if (e.key === 'Escape') {
      if (isPaused) handleResume();
      else handlePause();
      return;
    }

    const key = e.key.toLowerCase();
    const lane = props.settings.keyBindings.indexOf(key);
    if (lane !== -1) {
      handleLaneDown(lane);
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    const lane = props.settings.keyBindings.indexOf(key);
    if (lane !== -1) {
      handleLaneUp(lane);
    }
  }
</script>

<svelte:window 
  onkeydown={handleKeyDown} 
  onkeyup={handleKeyUp} 
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
/>

<div class="sekai-game-stage">
  <!-- プロセカ風トップステータスバー -->
  <div class="sekai-hud-top">
    <!-- 左側: ポーズ & 曲名 & 進行バー -->
    <div class="hud-left">
      <button class="sekai-pause-btn" onclick={handlePause} aria-label="Pause">
        ❚❚
      </button>

      <div class="song-meta-box">
        <div class="song-title-row">
          <span class="hud-song-name">{props.song.title}</span>
          <span class="sekai-diff-tag diff-{props.difficulty}">{props.difficulty}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: {progressPercent}%"></div>
        </div>
      </div>
    </div>

    <!-- 右側: スコア & LIFEバー -->
    <div class="hud-right">
      <div class="score-box">
        <span class="score-label">SCORE</span>
        <span class="score-val">{currentScore.toString().padStart(7, '0')}</span>
      </div>

      <div class="life-box">
        <div class="life-header">
          <span class="life-title">LIFE</span>
          <span class="life-num">{currentLife}</span>
        </div>
        <div class="life-track">
          <div 
            class="life-fill {currentLife < 300 ? 'danger' : ''}" 
            style="width: {(currentLife / 1000) * 100}%"
          ></div>
        </div>
      </div>
    </div>
  </div>

  <!-- プロセカ風 中央空面 コンボ & 判定ポップアップ -->
  <div class="sekai-center-judgments">
    {#if currentCombo >= 3}
      <div class="sekai-combo-display">
        <div class="combo-num">{currentCombo}</div>
        <div class="combo-text">COMBO</div>
      </div>
    {/if}

    {#if currentJudgment}
      {#key judgmentKey}
        <div class="sekai-judge-badge judge-{currentJudgment}">
          <span class="judge-word">{currentJudgment}</span>
        </div>
      {/key}
    {/if}
  </div>

  <!-- 3D Canvas プレイフィールド -->
  <div class="canvas-wrapper">
    <canvas bind:this={canvasEl} class="stage-canvas"></canvas>

    <!-- 画面下部 タッチボタン (Pointer Events) -->
    <div class="bottom-touch-panel">
      {#each [0, 1, 2, 3, 4, 5] as laneIdx}
        <button 
          class="sekai-touch-btn lane-{laneIdx} {activeLanes[laneIdx] ? 'pressed' : ''}"
          onpointerdown={(e) => handlePointerDown(e, laneIdx)}
          tabindex="-1"
          aria-label="Lane {laneIdx + 1}"
        >
          <div class="touch-hint-box">
            <span class="touch-lane-idx">{laneIdx + 1}</span>
            <span class="touch-key-name">{props.settings.keyBindings[laneIdx]?.toUpperCase()}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- カウントダウンオーバーレイ -->
  {#if countdownText}
    <div class="sekai-countdown-layer">
      <div class="sekai-count-circle">
        <span class="count-txt">{countdownText}</span>
      </div>
    </div>
  {/if}

  <!-- ポーズモーダル -->
  {#if isPaused}
    <div class="sekai-pause-overlay">
      <div class="pause-card sekai-panel">
        <h3 class="pause-title">PAUSE</h3>
        <p class="pause-song-sub">{props.song.title} - <span class="diff-tag diff-{props.difficulty}">{props.difficulty}</span></p>

        <div class="pause-actions">
          <button class="btn-sekai-live resume-btn" onclick={handleResume}>
            ▶ ライブ再開 (RESUME)
          </button>
          <button class="btn-sekai-secondary retry-btn" onclick={handleRetry}>
            🔄 最初からやり直す (RETRY)
          </button>
          <button class="btn-sekai-secondary quit-btn" onclick={handleQuitGame}>
            🚪 楽曲選択へ (QUIT)
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .sekai-game-stage {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: radial-gradient(circle at 50% 20%, #161e38 0%, #080a14 100%);
    position: relative;
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .sekai-hud-top {
    width: 100%;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    background: linear-gradient(180deg, rgba(10, 14, 28, 0.95) 0%, rgba(10, 14, 28, 0.6) 100%);
    border-bottom: 1.5px solid rgba(255, 255, 255, 0.1);
    z-index: 100;
  }

  .hud-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sekai-pause-btn {
    background: rgba(30, 42, 70, 0.9);
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    color: #ffffff;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .sekai-pause-btn:active {
    background: var(--sekai-cyan);
    color: #000;
  }

  .song-meta-box {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: 240px;
  }

  .song-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hud-song-name {
    font-size: 0.85rem;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sekai-diff-tag {
    font-family: var(--font-display);
    font-size: 0.65rem;
    padding: 2px 6px;
    border-radius: 10px;
  }

  .progress-track {
    width: 130px;
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sekai-cyan), #ffffff);
    border-radius: 2px;
    transition: width 0.1s linear;
  }

  .hud-right {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .score-box {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .score-label {
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 0.1em;
  }

  .score-val {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 900;
    line-height: 1;
    color: #ffffff;
    letter-spacing: 0.05em;
    text-shadow: 0 0 10px rgba(51, 204, 187, 0.6);
  }

  .life-box {
    display: flex;
    flex-direction: column;
    width: 120px;
    gap: 2px;
  }

  .life-header {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-display);
    font-size: 0.62rem;
    font-weight: 800;
  }

  .life-title { color: var(--sekai-green); }
  .life-num { color: #ffffff; }

  .life-track {
    width: 100%;
    height: 5px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    overflow: hidden;
  }

  .life-fill {
    height: 100%;
    background: linear-gradient(90deg, #33dd77, #66ffaa);
    border-radius: 3px;
    transition: width 0.15s ease-out;
  }

  .life-fill.danger {
    background: linear-gradient(90deg, #ff3344, #ff6677);
  }

  /* 中央判定 & コンボ */
  .sekai-center-judgments {
    position: absolute;
    top: 20%;
    left: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    z-index: 80;
  }

  .sekai-combo-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: comboBounce 0.1s ease-out;
  }

  .combo-num {
    font-family: var(--font-display);
    font-size: 3rem;
    font-weight: 900;
    line-height: 0.85;
    color: #ffffff;
    text-shadow: 0 0 16px var(--sekai-cyan), 0 2px 4px rgba(0, 0, 0, 0.8);
    letter-spacing: 0.04em;
  }

  .combo-text {
    font-family: var(--font-display);
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.25em;
    color: var(--sekai-cyan);
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.8);
  }

  .sekai-judge-badge {
    margin-top: 4px;
    font-family: var(--font-display);
    font-weight: 900;
    font-size: 1.65rem;
    letter-spacing: 0.08em;
    animation: judgePopAnim 0.35s ease-out forwards;
  }

  .judge-PERFECT {
    color: #fffb80;
    text-shadow: 0 0 20px #ffea00, 0 0 40px #ff3377;
  }
  .judge-GREAT { color: #ff66bb; text-shadow: 0 0 16px #ff3377; }
  .judge-GOOD { color: #66ffbb; text-shadow: 0 0 16px #33dd77; }
  .judge-BAD { color: #cc66ff; }
  .judge-MISS { color: #8899aa; }

  @keyframes judgePopAnim {
    0% { transform: scale(1.4) translateY(-10px); opacity: 1; }
    50% { transform: scale(1.0) translateY(0); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.85; }
  }

  @keyframes comboBounce {
    0% { transform: scale(1.2); }
    100% { transform: scale(1.0); }
  }

  /* Canvas レイヤー */
  .canvas-wrapper {
    flex: 1;
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .stage-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
  }

  /* ボトム タッチパネル */
  .bottom-touch-panel {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 68px;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    background: rgba(14, 18, 34, 0.95);
    border-top: 2px solid rgba(255, 255, 255, 0.2);
    z-index: 90;
  }

  .sekai-touch-btn {
    background: transparent;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: none;
    position: relative;
    outline: none;
  }

  .sekai-touch-btn:active, .sekai-touch-btn.pressed {
    background: rgba(255, 255, 255, 0.25);
  }

  .touch-hint-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  }

  .touch-lane-idx {
    font-family: var(--font-display);
    font-size: 0.95rem;
    font-weight: 900;
    color: #ffffff;
  }

  .touch-key-name {
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.45);
    font-weight: 700;
  }

  /* カウントダウン */
  .sekai-countdown-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 150;
  }

  .sekai-count-circle {
    width: 130px;
    height: 130px;
    border-radius: 50%;
    border: 3px solid var(--sekai-cyan);
    box-shadow: 0 0 30px var(--sekai-cyan);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(14, 20, 40, 0.85);
    animation: countBounce 0.7s ease-out infinite;
  }

  .count-txt {
    font-family: var(--font-display);
    font-size: 3.8rem;
    font-weight: 900;
    color: #ffffff;
    text-shadow: 0 0 20px var(--sekai-pink);
  }

  @keyframes countBounce {
    0% { transform: scale(0.6); opacity: 0; }
    50% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1.0); opacity: 1; }
  }

  /* ポーズモーダル */
  .sekai-pause-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(14px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 16px;
  }

  .pause-card {
    width: 100%;
    max-width: 380px;
    padding: 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .pause-title {
    font-family: var(--font-display);
    font-size: 1.8rem;
    color: var(--sekai-cyan);
    letter-spacing: 0.1em;
  }

  .pause-song-sub {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .pause-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 6px;
  }
</style>
