export type ScreenState = 'title' | 'settings' | 'select' | 'game' | 'result';

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'EXPERT' | 'MASTER';

export type NoteType = 'don' | 'ka' | 'big_don' | 'big_ka' | 'drumroll' | 'balloon';

export type JudgmentType = 'PERFECT' | 'GREAT' | 'GOOD' | 'BAD' | 'MISS';

export interface Note {
  id: number;
  time: number; // 秒数
  type: NoteType;
  // For drumroll or balloon, duration (seconds) indicates how long the roll lasts.
  duration?: number;
  // Runtime state for Taiko notes
  state?: 'idle' | 'hit' | 'holding' | 'miss' | 'rolled';
  // Progress for drumroll (0.0 ~ 1.0)
  holdProgress?: number;
  scoreGiven?: boolean;
}

export interface Chart {
  difficulty: Difficulty;
  level: number;
  notes: Note[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  audioSrc: string;
  jacketColor: string;
  accentColor: string;
  previewStart: number;
  previewDuration: number;
  charts: Record<Difficulty, Chart>;
}

export interface GameSettings {
  bgmVolume: number;    // 0.0 ~ 1.0
  seVolume: number;     // 0.0 ~ 1.0
  noteSpeed: number;    // 1.0 ~ 10.0 (落下速度倍率)
  offsetMs: number;     // -200 ~ +200 ms (判定オフセット)
  keyBindings: string[]; // 6レーン分のキー ['s', 'd', 'f', 'j', 'k', 'l']
}

export interface GameResult {
  song: Song;
  difficulty: Difficulty;
  score: number;
  maxScore: number;
  maxCombo: number;
  totalNotes: number;
  counts: Record<JudgmentType, number>;
  rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  isNewRecord: boolean;
}

export interface SongHighScore {
  score: number;
  rank: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  maxCombo: number;
  cleared: boolean;
}
