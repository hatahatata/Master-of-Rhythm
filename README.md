# CYBER BEAT (6-Lane Web Rhythm Game)

スマートフォン向けに最適化された、高精度・低遅延の6レーンWebリズムゲームです。
Svelte 5 + Vite + TypeScript で構築されており、Cloudflare Pages / Cloudflare Workers に即座にデプロイできます。

---

## 🌟 主な特徴

1. **スマートフォン最優先の操作設計**
   - 6レーン均等タッチ対応（Pointer Eventsによる超低遅延マルチタッチ）
   - ダブルタップズーム防止、スクロール防止（`touch-action: none` / `user-select: none`）
   - PCキーボード操作対応（デフォルト: `S`, `D`, `F`, `J`, `K`, `L`）
2. **Web Audio API による正確な音楽同期**
   - フレームレート非依存の `requestAnimationFrame` タイムライン同期
   - 判定タイミング調整（-200ms 〜 +200ms）でBluetoothイヤホン等のズレも補正
   - アセット読み込み待ちゼロの合成音ヒットサウンド（PERFECT / GREAT / GOOD / BAD / MISS）
3. **ノーツ & 判定システム**
   - ノーマルノーツ（単発タップ）
   - ロングノーツ（ホールド・帯表示）
   - 5段階判定（PERFECT / GREAT / GOOD / BAD / MISS）
   - BADまではコンボ継続、MISS（通過または早離し）のみコンボリセット
   - 最大1,000,000点スコアシステム
4. **5つの画面構成**
   - タイトル画面 (START, SETTINGS)
   - 設定画面 (BGM/SE音量, ノーツ速度, タイミングオフセット, キーバインド, localStorage保存)
   - 曲・難易度選択画面 (試聴プレビュー, EASY / NORMAL / HARD 難易度, ハイスコア表示)
   - ゲームプレイ画面 (3-2-1-STARTカウントダウン, 6レーンプレイ, 一時停止モーダル)
   - リザルト画面 (最終スコア, ランク判定 SSS〜D, MAX COMBO, 各判定数内訳, RETRY / 曲選択)
5. **魔王魂の楽曲3曲 & 盛り上がり連動譜面**
   - 『シャイニングスター』 (BPM 152)
   - 『ハルジオン』 (BPM 140)
   - 『12345』 (BPM 132)
   - サビやラスサビの盛り上がり部分で同時押しや16分乱打、階段、ホールドが激しく展開

---

## 📁 作成ファイル構成

```
├── public/
│   ├── _headers             # Cloudflare Pages 用キャッシュ/CORS設定
│   └── audio/               # 楽曲ファイル (MP3)
│       ├── 12345.mp3
│       ├── halzion.mp3
│       └── shining_star.mp3
├── src/
│   ├── components/
│   │   ├── TitleScreen.svelte       # 1. タイトル画面
│   │   ├── SettingsScreen.svelte    # 2. 設定画面
│   │   ├── SongSelectScreen.svelte  # 3. 曲・難易度選択画面
│   │   ├── GameScreen.svelte        # 4. ゲームプレイ画面 (6レーン)
│   │   └── ResultScreen.svelte      # 5. リザルト画面
│   ├── data/
│   │   └── songs.ts                 # 楽曲データ & 6レーン譜面データ
│   ├── utils/
│   │   ├── audio.ts                 # Web Audio API 音楽同期 & 低遅延SE
│   │   └── storage.ts               # localStorage 設定 & ハイスコア管理
│   ├── App.svelte                   # 全体画面ルーティング
│   ├── app.css                      # サイバーパンクUI & レスポンシブCSS
│   ├── main.ts                      # エントリーポイント
│   └── types.ts                     # TypeScript 型定義
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.toml                    # Cloudflare デプロイ設定
```

---

## 🚀 開発・起動方法

### 1. 依存関係のインストール
```bash
npm install
```

### 2. ローカル開発サーバーの起動
```bash
npm run dev
```
ブラウザで `http://localhost:5173/` にアクセスします。
（スマホ実機でテストする場合は、PCと同じWi-Fiに接続し `npm run dev -- --host` で表示されるIPアドレスへアクセスしてください）

### 3. 本番ビルド
```bash
npm run build
```
`dist/` フォルダに最適化された静的アセットが出力されます。

---

## ☁ Cloudflare へのデプロイ方法

### 方法 A: Cloudflare Pages Git連携（推奨）
1. GitHub などのリポジトリに本プロジェクトをプッシュします。
2. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログインし、**Workers & Pages** > **Pages** > **Connect to Git** を選択します。
3. リポジトリを選択し、以下のビルド設定を入力します：
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Save and Deploy** をクリックすると、自動的にビルドとグローバル配信が完了します。

### 方法 B: Wrangler CLI を使用した直接デプロイ
```bash
# Wrangler でログイン
npx wrangler login

# dist フォルダを Cloudflare Pages にデプロイ
npx wrangler pages deploy dist --project-name=cyber-beat
```

---

## 🎵 譜面（Chart）を追加・編集する方法

`src/data/songs.ts` を編集することで、簡単に曲や譜面を追加・調整できます。

### 1. 新しい曲の追加
1. 音声ファイル（.mp3）を `public/audio/` に配置します。
2. `src/data/songs.ts` の `SONGS` 配列に曲情報を追加します：

```typescript
{
  id: 'my_song',
  title: '曲名',
  artist: 'アーティスト名',
  bpm: 145,
  audioSrc: '/audio/my_song.mp3',
  jacketColor: 'linear-gradient(135deg, #ff007f, #7928ca)',
  accentColor: '#ff007f',
  previewStart: 30.0,    // 試聴開始秒数
  previewDuration: 15.0, // 試聴秒数
  charts: {
    EASY: { difficulty: 'EASY', level: 3, notes: [...] },
    NORMAL: { difficulty: 'NORMAL', level: 7, notes: [...] },
    HARD: { difficulty: 'HARD', level: 10, notes: [...] },
  }
}
```

### 2. ノーツの定義フォーマット
- **通常ノーツ (normal)**:
```json
{
  "id": 1,
  "time": 1.250,
  "lane": 2,
  "type": "normal"
}
```
- **ロングノーツ (long)**:
```json
{
  "id": 2,
  "time": 3.500,
  "lane": 4,
  "type": "long",
  "duration": 1.500
}
```
* `time`: 音楽開始からの秒数
* `lane`: `0` 〜 `5`（左から順に第1レーン〜第6レーン）
* `type`: `'normal'` または `'long'`
* `duration`: ロングノーツの継続時間（秒）
