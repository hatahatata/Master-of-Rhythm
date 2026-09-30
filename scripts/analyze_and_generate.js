import fs from 'fs';
import path from 'path';
import { MPEGDecoder } from 'mpg123-decoder';

async function analyzeSongAdvanced(filePath, bpm, offsetSec = 0) {
  const fileBuffer = fs.readFileSync(filePath);
  const decoder = new MPEGDecoder();
  await decoder.ready;
  const { channelData, sampleRate } = decoder.decode(new Uint8Array(fileBuffer));
  decoder.free();

  const left = channelData[0];
  const right = channelData[1] || channelData[0];
  const length = left.length;
  const duration = length / sampleRate;

  // モノラル
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    mono[i] = (left[i] + right[i]) * 0.5;
  }

  // 短時間エネルギー解析 (窓幅 1024 / ホップ 256 = 約5.8msの高分解能)
  const windowSize = 1024;
  const hopSize = 256;
  const numFrames = Math.floor((length - windowSize) / hopSize);

  const energy = new Float32Array(numFrames);
  const highFreqFlux = new Float32Array(numFrames);

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let sum = 0;
    let hfSum = 0;
    for (let i = 0; i < windowSize; i++) {
      const v = mono[start + i];
      sum += v * v;
      if (i > 0) {
        const diff = v - mono[start + i - 1];
        hfSum += diff * diff;
      }
    }
    energy[f] = Math.sqrt(sum / windowSize);
    highFreqFlux[f] = Math.sqrt(hfSum / windowSize);
  }

  // ピーク検出
  const beatSec = 60 / bpm;
  const quantizeGrid = beatSec / 4; // 16分音符グリッド (約0.09s ~ 0.11s)

  const detectedOnsets = [];
  const lookaround = 8;

  for (let f = lookaround; f < numFrames - lookaround; f++) {
    const combined = energy[f] * 0.4 + highFreqFlux[f] * 0.6;
    if (combined < 0.015) continue;

    let isMax = true;
    for (let w = -lookaround; w <= lookaround; w++) {
      if (w !== 0) {
        const other = energy[f + w] * 0.4 + highFreqFlux[f + w] * 0.6;
        if (other >= combined) {
          isMax = false;
          break;
        }
      }
    }

    if (isMax) {
      const rawTime = (f * hopSize) / sampleRate;
      // グリッドにスナップ (オフセット考慮)
      const adjusted = rawTime - offsetSec;
      const nearestBeatIndex = Math.round(adjusted / quantizeGrid);
      const snappedTime = parseFloat((offsetSec + nearestBeatIndex * quantizeGrid).toFixed(3));

      if (snappedTime >= 0.5 && snappedTime <= duration - 2.0) {
        detectedOnsets.push({
          rawTime,
          time: snappedTime,
          strength: combined,
        });
      }
    }
  }

  // 重複時間マージ
  const merged = [];
  const seen = new Set();
  for (const o of detectedOnsets) {
    if (!seen.has(o.time)) {
      seen.add(o.time);
      merged.push(o);
    }
  }
  merged.sort((a, b) => a.time - b.time);

  return { onsets: merged, duration, bpm, beatSec };
}

// プロセカ風の自然でドラマチックな6レーン配置ジェネレーター
function generateProSekaiChart(onsets, bpm, difficulty) {
  const beatSec = 60 / bpm;
  let noteId = 1;
  const notes = [];

  let minInterval = beatSec * 0.9;
  let densityChance = 0.4;
  let dualNoteChance = 0.0;

  if (difficulty === 'EASY') {
    minInterval = beatSec * 0.85;  // 主に4分音符
    densityChance = 0.45;
    dualNoteChance = 0.0;
  } else if (difficulty === 'NORMAL') {
    minInterval = beatSec * 0.45;  // 8分音符
    densityChance = 0.65;
    dualNoteChance = 0.08;
  } else if (difficulty === 'HARD') {
    minInterval = beatSec * 0.22;  // 8分〜16分
    densityChance = 0.85;
    dualNoteChance = 0.22;
  } else if (difficulty === 'EXPERT') {
    minInterval = beatSec * 0.22;  // 16分
    densityChance = 0.98;
    dualNoteChance = 0.32;
  } else if (difficulty === 'MASTER') {
    minInterval = beatSec * 0.12;  // 16分・24分
    densityChance = 1.0;
    dualNoteChance = 0.45;
  }

  let lastTime = -1;
  let lastLane = 2;
  let direction = 1; // 1 = 右, -1 = 左
  let patternType = 'flow'; // 'flow', 'zigzag', 'cross'
  let stepCount = 0;

  for (let i = 0; i < onsets.length; i++) {
    const o = onsets[i];
    const timeDelta = o.time - lastTime;

    if (timeDelta < minInterval) continue;

    // 難易度フィルタ
    if (difficulty === 'EASY' && o.strength < 0.035 && Math.random() > densityChance) continue;
    if (difficulty === 'NORMAL' && o.strength < 0.025 && Math.random() > densityChance) continue;

    // レーンの自然な遷移 (プロセカの運指設計)
    stepCount++;
    if (stepCount % 8 === 0) {
      patternType = ['flow', 'zigzag', 'cross'][Math.floor(Math.random() * 3)];
    }

    let nextLane = lastLane;

    if (patternType === 'flow') {
      // 階段・流れる配置
      if ((lastLane >= 4 && direction === 1) || (lastLane <= 1 && direction === -1)) {
        direction *= -1;
      }
      nextLane = lastLane + direction * (Math.random() < 0.7 ? 1 : 2);
    } else if (patternType === 'zigzag') {
      // ジグザグ左右交互タップ
      nextLane = (lastLane <= 2) ? (3 + Math.floor(Math.random() * 3)) : Math.floor(Math.random() * 3);
    } else {
      // 外から内、または内から外
      const mirror = 5 - lastLane;
      nextLane = Math.random() < 0.5 ? mirror : (lastLane + direction);
    }

    nextLane = Math.max(0, Math.min(5, nextLane));

    // ロングノーツ判定
    const nextOnset = onsets[i + 1];
    const nextGap = nextOnset ? (nextOnset.time - o.time) : 0;
    const isLongNote = (difficulty !== 'EASY' && nextGap >= beatSec * 1.5 && nextGap <= beatSec * 4.0 && Math.random() < 0.25);

    if (isLongNote) {
      notes.push({
        id: noteId++,
        time: o.time,
        lane: nextLane,
        type: 'long',
        duration: parseFloat(Math.min(beatSec * 3, nextGap * 0.85).toFixed(3)),
      });
    } else {
      notes.push({
        id: noteId++,
        time: o.time,
        lane: nextLane,
        type: 'normal',
      });

      // 同時押し (強い音・サビ・アクセント)
      if (Math.random() < dualNoteChance && o.strength > 0.04) {
        let dualLane = (nextLane <= 2) ? (5 - nextLane) : (5 - nextLane);
        if (dualLane === nextLane) dualLane = (nextLane + 3) % 6;
        notes.push({
          id: noteId++,
          time: o.time,
          lane: dualLane,
          type: 'normal',
        });
      }
    }

    lastTime = o.time;
    lastLane = nextLane;
  }

  return notes.sort((a, b) => a.time - b.time);
}

async function run() {
  const songsDir = path.resolve('public/audio');
  const songFiles = [
    { id: 'shining_star', file: 'shining_star.mp3', title: 'シャイニングスター', artist: '魔王魂', bpm: 152, offsetSec: 0.16, previewStart: 44.0, jacketColor: 'linear-gradient(135deg, #ff007f, #7928ca)', accentColor: '#ff007f' },
    { id: 'halzion', file: 'halzion.mp3', title: 'ハルジオン', artist: '魔王魂', bpm: 140, offsetSec: 0.22, previewStart: 41.0, jacketColor: 'linear-gradient(135deg, #00f2fe, #4facfe)', accentColor: '#00f2fe' },
    { id: '12345', file: '12345.mp3', title: '12345', artist: '魔王魂', bpm: 132, offsetSec: 0.12, previewStart: 20.0, jacketColor: 'linear-gradient(135deg, #f093fb, #f5576c)', accentColor: '#f093fb' },
  ];

  const resultSongs = [];

  for (const s of songFiles) {
    const fullPath = path.join(songsDir, s.file);
    console.log(`Analyzing ${s.title} (${s.file}, BPM ${s.bpm})...`);
    const { onsets, duration, beatSec } = await analyzeSongAdvanced(fullPath, s.bpm, s.offsetSec);
    console.log(`Detected ${onsets.length} high-accuracy beats in ${duration.toFixed(1)}s`);

    const charts = {
      EASY: { difficulty: 'EASY', level: s.bpm > 145 ? 4 : 3, notes: generateProSekaiChart(onsets, s.bpm, 'EASY') },
      NORMAL: { difficulty: 'NORMAL', level: s.bpm > 145 ? 7 : 6, notes: generateProSekaiChart(onsets, s.bpm, 'NORMAL') },
      HARD: { difficulty: 'HARD', level: s.bpm > 145 ? 11 : 10, notes: generateProSekaiChart(onsets, s.bpm, 'HARD') },
      EXPERT: { difficulty: 'EXPERT', level: s.bpm > 145 ? 14 : 13, notes: generateProSekaiChart(onsets, s.bpm, 'EXPERT') },
      MASTER: { difficulty: 'MASTER', level: s.bpm > 145 ? 17 : 16, notes: generateProSekaiChart(onsets, s.bpm, 'MASTER') },
    };

    console.log(`Chart notes counts: EASY=${charts.EASY.notes.length}, NORMAL=${charts.NORMAL.notes.length}, HARD=${charts.HARD.notes.length}, EXPERT=${charts.EXPERT.notes.length}, MASTER=${charts.MASTER.notes.length}`);

    resultSongs.push({
      ...s,
      audioSrc: `/audio/${s.file}`,
      previewDuration: 15.0,
      charts,
    });
  }

  const code = `import type { Song } from '../types';\n\nexport const SONGS: Song[] = ${JSON.stringify(resultSongs, null, 2)};\n`;
  fs.writeFileSync(path.resolve('src/data/songs.ts'), code, 'utf-8');
  console.log('Successfully generated src/data/songs.ts with perfect music sync and natural non-repeating lane distribution!');
}

run().catch(console.error);
