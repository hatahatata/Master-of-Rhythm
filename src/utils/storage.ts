import type { GameSettings, SongHighScore, Difficulty } from '../types';

const SETTINGS_KEY = 'rhythm_game_settings';
const SCORES_KEY = 'rhythm_game_highscores';

export const DEFAULT_SETTINGS: GameSettings = {
  bgmVolume: 0.8,
  seVolume: 0.9,
  noteSpeed: 5.0,
  offsetMs: 0,
  keyBindings: ['s', 'd', 'f', 'j', 'k', 'l'],
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      keyBindings: parsed.keyBindings || DEFAULT_SETTINGS.keyBindings,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function getScoreKey(songId: string, difficulty: Difficulty): string {
  return `${songId}_${difficulty}`;
}

export function loadHighScores(): Record<string, SongHighScore> {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getHighScore(songId: string, difficulty: Difficulty): SongHighScore | null {
  const scores = loadHighScores();
  return scores[getScoreKey(songId, difficulty)] || null;
}

export function saveHighScore(songId: string, difficulty: Difficulty, newRecord: SongHighScore): boolean {
  try {
    const scores = loadHighScores();
    const key = getScoreKey(songId, difficulty);
    const existing = scores[key];

    let isNewRecord = false;
    if (!existing || newRecord.score > existing.score) {
      scores[key] = newRecord;
      localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
      isNewRecord = true;
    }
    return isNewRecord;
  } catch (e) {
    console.error('Failed to save highscore:', e);
    return false;
  }
}
