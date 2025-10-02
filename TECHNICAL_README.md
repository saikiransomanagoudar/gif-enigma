# GIF Enigma - Technical Documentation

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Core Systems](#core-systems)
- [API Integrations](#api-integrations)
- [Data Persistence](#data-persistence)
- [Build & Deployment](#build--deployment)
- [Development Workflow](#development-workflow)
- [Environment Setup](#environment-setup)
- [Key Components](#key-components)

---

## Overview

GIF Enigma is a Reddit-native interactive word/phrase guessing game built as a Devvit application. Players interpret progressive GIF hints to uncover hidden words or phrases, with a sophisticated scoring system that penalizes hint usage. The application features both a player mode and a creator mode, allowing users to design their own puzzles using AI-assisted hint generation.

### Platform

Built on the **Reddit Devvit Platform** (v0.11.15), leveraging:
- Custom post types with embedded WebView
- Reddit's native rendering engine (Blocks)
- Real-time bidirectional messaging
- Reddit Media API for asset hosting
- Redis-based data persistence

---

## Technology Stack

### Frontend

- **Framework**: React 19.0.0
- **Build Tool**: Vite 6.2.0
- **Language**: TypeScript 5.8.3
- **Styling**: Tailwind CSS 4.0.13
- **Animation**: Framer Motion 12.5.0
- **Routing**: React Router DOM 7.4.0

### Backend

- **Platform**: Devvit Public API 0.11.15
- **Runtime**: Reddit's serverless Devvit environment
- **Database**: Redis (via Devvit's context.redis)
- **HTTP Client**: Axios 1.8.3 + native fetch

### External Services

- **AI Generation**: Google Gemini API (@google/generative-ai 0.24.0)
- **GIF Search**: Tenor API (Google's GIF platform)
- **Media Hosting**: Reddit Media API

### Development Tools

- **Package Manager**: npm
- **Concurrent Tasks**: concurrently 9.1.2
- **Code Formatting**: Prettier 3.5.2
- **Devvit CLI**: devvit 0.12.0

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Reddit Platform                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Devvit Custom Post                      │ │
│  │  ┌─────────────────┐         ┌─────────────────────────┐  │ │
│  │  │  Reddit Blocks  │◄────────┤   Server-Side Handler   │  │ │
│  │  │   (Preview)     │         │  (src/main.tsx)         │  │ │
│  │  └─────────────────┘         └──────────┬──────────────┘  │ │
│  │                                         │                  │ │
│  │  ┌─────────────────┐                   │                  │ │
│  │  │    WebView      │◄──────────────────┘                  │ │
│  │  │  (React App)    │                                      │ │
│  │  │  game/App.tsx   │                                      │ │
│  │  └────────┬────────┘                                      │ │
│  │           │                                                │ │
│  └───────────┼────────────────────────────────────────────────┘ │
│              │                                                  │
│  ┌───────────▼────────────────────────────────────────────────┐ │
│  │                  Server-Side Services                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │ │
│  │  │ Game Handler │  │Score Service │  │ Tenor/Gemini    │ │ │
│  │  │   (Redis)    │  │              │  │ API Integrations│ │ │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
      ┌─────▼─────┐  ┌─────▼──────┐  ┌────▼─────┐
      │  Reddit   │  │   Tenor    │  │  Gemini  │
      │ Media API │  │  GIF API   │  │    AI    │
      └───────────┘  └────────────┘  └──────────┘
```

### Communication Flow

1. **Initialization**: WebView sends `INIT` message to Devvit handler
2. **Bidirectional Messaging**: PostMessage API for React ↔ Devvit communication
3. **State Management**: Redis for persistent storage, React state for UI
4. **Navigation**: Custom navigation system with Redis-backed state persistence
5. **Asset Loading**: GIFs uploaded to Reddit Media, cached in Redis

---

## Project Structure

```
gif-enigma/
├── src/                          # Devvit server-side code
│   ├── main.tsx                 # Main Devvit handler & message router
│   ├── components/              # Reddit Blocks components
│   │   ├── Preview.tsx         # Default post preview
│   │   ├── GamePostPreview.tsx # Game-specific preview
│   │   └── CustomPostPreview.tsx
│   └── utils/
│       ├── fonts/              # Custom font utilities
│       ├── PageTransition.tsx  # Transition components
│       └── transitions.ts      # Animation configs
│
├── game/                         # React WebView application
│   ├── App.tsx                  # Main React app & message handler
│   ├── main.tsx                 # React entry point
│   ├── pages/                   # Application pages
│   │   ├── LandingPage.tsx     # Home screen
│   │   ├── CategoryPage.tsx    # Category selection
│   │   ├── CreatePage.tsx      # Creator mode
│   │   ├── GamePage.tsx        # Game play interface
│   │   ├── HowToPlayPage.tsx   # Instructions
│   │   └── LeaderboardPage.tsx # Leaderboards
│   ├── components/
│   │   ├── LeaderBoardCard.tsx
│   │   ├── Modal.tsx
│   │   └── UserStatsCard.tsx
│   ├── lib/
│   │   ├── types.ts            # TypeScript definitions
│   │   ├── fonts.tsx           # Font loading utilities
│   │   ├── styles.ts           # Style utilities
│   │   ├── useLeaderboard.ts   # Leaderboard hook
│   │   └── useMediaQuery.ts    # Responsive utilities
│   ├── server/                  # Server-side logic
│   │   ├── gameHandler.server.ts         # Game CRUD operations
│   │   ├── gameHandler.ts               # Additional game utilities
│   │   ├── geminiApi.server.ts          # Gemini AI integration
│   │   ├── geminiService.ts             # Gemini service layer
│   │   ├── tenorApi.server.ts           # Tenor GIF search
│   │   ├── tenorApi.ts                  # Tenor utilities
│   │   ├── scoringService.ts            # Score calculation & storage
│   │   ├── userStats.ts                 # User statistics
│   │   └── autoCreateGameScheduler.ts   # Automated game posting
│   ├── shared.ts                # Shared type definitions
│   ├── public/                  # Static assets
│   │   ├── fonts/
│   │   ├── landing-page/
│   │   └── create-page/
│   └── index.html
│
├── webroot/                      # Built output (generated by Vite)
│   ├── assets/
│   └── index.html
│
├── devvit.yaml                  # Devvit app configuration
├── package.json
├── vite.config.js               # Vite build configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
└── postcss.config.js            # PostCSS configuration
```

---

## Core Systems

### 1. Game Flow System

**States**: `loading` → `playing` → `won` | `lost` | `completed`

**Player State Structure**:
```typescript
interface PlayerGameState {
  gifHintCount: number;           // Number of GIF hints revealed (0-4)
  revealedLetters: number[];      // Indices of revealed letters
  guess: string;                  // Current guess
  lastPlayed: number;             // Timestamp
  isCompleted: boolean;           // Completion status
}
```

**Game Data Structure**:
```typescript
interface GameData {
  id: string;                     // Unique game identifier
  word: string;                   // Answer (hidden from client)
  maskedWord: string;             // Partially visible answer
  category?: string;              // Movies/Gaming/Books/General
  questionText: string;           // Prompt text
  gifs: string[];                 // 4 progressive hint GIFs
  createdAt?: string;
  username?: string;              // Creator
  redditPostId?: string;
  isChatPost?: boolean;
}
```

### 2. Scoring System

**Base Score**: 100 points

**Penalties**:

**GIF Hints** (progressive):
- 2 GIFs revealed: -10 points
- 3 GIFs revealed: -20 points
- 4 GIFs revealed: -40 points

**Word/Phrase Hints** (based on answer length):

| Length | Hints Available | Letters per Hint | Penalty per Hint |
|--------|----------------|------------------|------------------|
| 5-7    | 1              | 2                | -50 points       |
| 8-10   | 2              | 2                | -25 points       |
| 11-15  | 3              | 2                | -15 points       |
| 16-25  | 3              | 3                | -10 points       |

**Time Penalty**: -1 point per minute (max -10 points)

**Implementation**: `game/server/scoringService.ts::calculateScore()`

### 3. Leaderboard System

**Three Leaderboard Types**:

1. **Game-Specific Leaderboard**
   - Redis Key: `leaderboard:{gameId}`
   - Type: Sorted Set (ZSET)
   - Sorted by: Individual game score (descending)

2. **Global Leaderboard**
   - Redis Key: `globalLeaderboard`
   - Type: Sorted Set
   - Members: `{gameId}:{username}`
   - Shows best single-game performances

3. **Cumulative Leaderboard**
   - Redis Key: `cumulativeLeaderboard`
   - Type: Sorted Set
   - Tracks total score across all games
   - Associated user stats: `userStats:{username}` (Hash)

**User Statistics Tracked**:
```typescript
{
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  bestScore: number;
  averageScore: number;
  lastPlayed: timestamp;
}
```

### 4. Navigation System

**Page Types**: `landing` | `category` | `create` | `game` | `howToPlay` | `leaderboard`

**Navigation Flow**:
```
Landing Page → Category Selection → Creator Mode → Game Posted
           ↓
         Play Game → Leaderboard
```

**State Persistence**:
- Redis Key: `navState:{postId}`
- Stores: current page and optional gameId
- Fallback: localStorage for client-side recovery
- Timeout: 2s for navigation state requests

**Implementation**:
- Frontend: `game/App.tsx::handleNavigate()`
- Backend: `src/main.tsx` (NAVIGATE message handler)

---

## API Integrations

### 1. Google Gemini AI API

**Purpose**: Generate category-appropriate words/phrases and progressive hint synonyms

**Endpoints Used**:
- `generateContent` (Gemini 2.0 Flash Model)

**Two Main Functions**:

#### Word/Phrase Recommendations
```typescript
fetchGeminiRecommendations(
  context: Context,
  category: 'Movies' | 'Gaming' | 'Books' | 'General',
  inputType: 'word' | 'phrase',
  count: number
): Promise<{ success: boolean; recommendations: string[]; error?: string }>
```

**Caching**:
- Redis Key Pattern: `gemini:recs:{category}:{inputType}:{count}:day{dayOfWeek}`
- TTL: 1 hour
- Rotation: Daily cache rotation for variety

#### Progressive Hint Synonyms
```typescript
fetchGeminiSynonyms(
  context: Context,
  word: string
): Promise<{ success: boolean; synonyms: string[][]; error?: string }>
```

Returns 4 synonym groups (abstract → specific):
1. Abstract/thematic connection
2. Related concept
3. Visual/auditory element
4. Direct/obvious clue

**Example for "Clock"**:
```javascript
[
  ["rotation", "spinning"],         // Abstract
  ["ticktock", "rhythm"],           // Thematic
  ["mechanism", "gears"],           // Component
  ["chiming", "bells", "time"]      // Direct
]
```

**Implementation**: `game/server/geminiApi.server.ts`, `game/server/geminiService.ts`

### 2. Tenor GIF API

**Purpose**: Search and retrieve GIFs for hint creation

**Endpoint**: `https://tenor.googleapis.com/v2/search`

**Function**:
```typescript
searchTenorGifs(
  context: Context,
  query: string,
  limit: number = 16
): Promise<TenorGifResult[]>
```

**Features**:
- Multi-format support: `gif`, `mediumgif`, `tinygif`, `nanogif`
- Content filtering: `high` safety level
- Media upload: GIFs uploaded to Reddit Media API for hosting
- Redis caching: Query results cached for 24 hours

**GIF Result Structure**:
```typescript
interface TenorGifResult {
  id: string;
  title: string;
  media_formats: {
    gif: TenorGifFormat;
    tinygif: TenorGifFormat;
    mediumgif: TenorGifFormat;
    nanogif: TenorGifFormat;
  };
  content_description: string;
  url: string;
}
```

**Caching Strategy**:
- Query cache: `tenor_search:{encodedQuery}` (24h TTL)
- Individual GIF cache: `tenor_gif:{gifId}` (24h TTL)
- All formats uploaded and cached together

**Implementation**: `game/server/tenorApi.server.ts`

### 3. Reddit Media API

**Purpose**: Host GIFs within Reddit's infrastructure

**Usage**:
```typescript
context.media.upload({
  url: gifUrl,
  type: 'gif'
})
```

**Benefits**:
- CDN delivery
- No external dependencies in production
- Automatic format optimization
- Integrated with Reddit's infrastructure

---

## Data Persistence

### Redis Schema

#### Game Storage
```
game:{gameId}                    # Hash
├─ word: string
├─ maskedWord: string
├─ category: string
├─ questionText: string
├─ gifs: JSON string[]
├─ createdAt: timestamp
├─ username: string
├─ redditPostId?: string
└─ isChatPost?: boolean

activeGames                      # Sorted Set (ZSET)
└─ score: timestamp, member: gameId

post:{postId}                    # Hash
├─ gameId: string
├─ created: timestamp
└─ isChatPost?: boolean

gamePreview:{gameId}             # Hash (for post previews)
├─ maskedWord: string
├─ gifs: JSON string[]
├─ creatorUsername: string
└─ isChatPost?: boolean
```

#### Player State
```
gameState:{gameId}:{username}    # Hash
├─ playerState: JSON PlayerGameState
└─ lastUpdated: timestamp

user:{username}:completedGames   # Sorted Set
└─ score: timestamp, member: gameId
```

#### Scoring & Leaderboards
```
score:{gameId}:{username}        # Hash
├─ username: string
├─ gameId: string
├─ score: number
├─ gifPenalty: number
├─ wordPenalty: number
├─ timeTaken: number
└─ timestamp: number

leaderboard:{gameId}             # Sorted Set
└─ score: gameScore, member: username

globalLeaderboard                # Sorted Set
└─ score: gameScore, member: "{gameId}:{username}"

cumulativeLeaderboard            # Sorted Set
└─ score: totalScore, member: username

userStats:{username}             # Hash
├─ gamesPlayed: number
├─ gamesWon: number
├─ totalScore: number
├─ bestScore: number
├─ averageScore: number
└─ lastPlayed: timestamp
```

#### Caching
```
gemini:recs:{category}:{type}:{count}:day{day}  # String (JSON array)
gemini:syn:{word}:day{day}                      # String (JSON array)
tenor_search:{encodedQuery}                     # String (JSON array)
tenor_gif:{gifId}                               # String (JSON object)

navState:{postId}                               # Hash
├─ page: Page
└─ gameId?: string
```

**TTL (Time To Live)**:
- Game states: 30 days
- Gemini cache: 1 hour
- Tenor cache: 24 hours
- Navigation state: Session-based (no explicit TTL)

---

## Build & Deployment

### Build Configuration

**Vite Configuration** (`vite.config.js`):
```javascript
{
  root: "game",
  build: {
    outDir: "../webroot",
    emptyOutDir: true,
    sourcemap: true,
    base: "./"  // Relative paths for Reddit hosting
  }
}
```

**Output Structure**:
```
webroot/
├── index.html
├── assets/
│   ├── index-{hash}.js
│   ├── index-{hash}.js.map
│   └── index-{hash}.css
├── fonts/
├── create-page/
└── landing-page/
```

### Build Scripts

```json
{
  "dev:game": "vite build --watch",
  "dev:devvit": "devvit playtest r/PlayGIFEnigma",
  "dev": "concurrently (both commands)",
  "build:react": "vite build",
  "build": "npm run build:react",
  "upload": "devvit upload",
  "start": "devvit dev"
}
```

### Deployment Process

1. **Build React App**:
   ```bash
   npm run build
   ```
   - Compiles TypeScript
   - Bundles with Vite
   - Outputs to `webroot/`

2. **Upload to Devvit**:
   ```bash
   devvit upload
   ```
   - Packages entire app
   - Uploads to Reddit's Devvit platform
   - Deploys to subreddit

3. **Playtest Mode** (Development):
   ```bash
   devvit playtest r/PlayGIFEnigma
   ```
   - Hot reload for server-side changes
   - Watch mode for React app

---

## Development Workflow

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   - Set up Devvit app in Reddit's Developer Portal
   - Configure app settings in subreddit:
     - `tenor-api-key`: Tenor API key
     - `gemini-api-key`: Google Gemini API key
     - `oauth-client-id`: Reddit OAuth client ID

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   This runs two processes concurrently:
   - Vite watch mode (rebuilds on file changes)
   - Devvit playtest server

4. **Test in Subreddit**:
   - Navigate to test subreddit
   - Create custom post via "Create GIF Enigma" menu item
   - Test gameplay and creator modes

### Message Flow Debugging

**Frontend (React)**:
```javascript
// Send message to Devvit
window.parent.postMessage({
  type: 'GET_GAME',
  data: { gameId: 'game_123' }
}, '*');

// Receive response
window.addEventListener('message', (event) => {
  if (event.data.type === 'GET_GAME_RESULT') {
    console.log(event.data.game);
  }
});
```

**Backend (Devvit)**:
```typescript
useWebView({
  onMessage: async (message) => {
    if (message.type === 'GET_GAME') {
      const game = await getGame(message.data, context);
      postMessage({
        type: 'GET_GAME_RESULT',
        success: game.success,
        game: game.game
      });
    }
  }
});
```

### Common Development Tasks

**Add New Page**:
1. Create page component in `game/pages/`
2. Add page type to `game/lib/types.ts::Page`
3. Add route in `game/App.tsx::renderPage()`
4. Update navigation handlers

**Add New Message Type**:
1. Define in `game/shared.ts`:
   - Add to `WebviewToBlockMessage` (frontend → backend)
   - Add to `BlocksToWebviewMessage` (backend → frontend)
2. Add handler in `src/main.tsx::onMessage`
3. Add sender in `game/App.tsx`

**Add New API Endpoint**:
1. Create service function in `game/server/`
2. Add message handler in `src/main.tsx`
3. Add client-side caller in `game/App.tsx`

---

## Environment Setup

### Required API Keys

1. **Tenor API Key**
   - Obtain from: [Google Cloud Console](https://console.cloud.google.com/)
   - Enable: "Tenor API" in Google Cloud
   - Set in subreddit settings: `tenor-api-key`

2. **Google Gemini API Key**
   - Obtain from: [Google AI Studio](https://makersuite.google.com/)
   - Set in subreddit settings: `gemini-api-key`

3. **Reddit OAuth**
   - Create app in [Reddit Developer Portal](https://www.reddit.com/prefs/apps)
   - Set in subreddit settings: `oauth-client-id`

### Devvit Configuration

**devvit.yaml**:
```yaml
name: gif-enigma
version: 0.11.0.29
```

**Settings Schema** (defined in `src/main.tsx`):
```typescript
Devvit.addSettings([
  {
    name: 'tenor-api-key',
    label: 'Tenor API Key',
    type: 'string',
    isSecret: true,
    scope: 'app'
  },
  {
    name: 'gemini-api-key',
    label: 'Gemini API Key',
    type: 'string',
    isSecret: true,
    scope: 'app'
  },
  {
    name: 'oauth-client-id',
    label: 'OAuth Client ID',
    type: 'string',
    isSecret: true,
    scope: 'app'
  },
  {
    name: 'allOriginalContent',
    label: 'Require All Original Content',
    type: 'boolean',
    defaultValue: false
  },
  {
    name: 'allowChatPostCreation',
    label: 'Allow Chat Post Creation',
    type: 'boolean',
    defaultValue: true
  }
])
```

**Required Permissions**:
```typescript
Devvit.configure({
  redditAPI: true,    // Reddit post/comment operations
  media: true,        // Upload GIFs
  kvStore: true,      // Legacy storage (unused)
  redis: true,        // Primary data storage
  http: true,         // External API calls
  realtime: true      // WebView messaging
});
```

---

## Key Components

### Frontend Components

#### `game/App.tsx`
**Purpose**: Main React application and message router

**Responsibilities**:
- WebView initialization and ready state
- PostMessage communication with Devvit
- Client-side navigation and state management
- Message unwrapping and routing
- Page rendering

**Key State**:
```typescript
- currentPage: Page
- gameId: string | null
- userData: { username: string; currentCounter: number }
- searchResults: TenorGifResult[]
- recommendations: string[]
- synonyms: string[][]
- isLoading: { [key: string]: boolean }
```

#### `game/pages/GamePage.tsx`
**Purpose**: Main gameplay interface

**Features**:
- GIF hint progression display
- Letter reveal system
- Guess input and validation
- Score calculation and display
- Win/lose state handling
- Game state persistence

#### `game/pages/CreatePage.tsx`
**Purpose**: Creator mode for puzzle design

**Workflow**:
1. Display AI-recommended words/phrases
2. For each GIF hint (4 total):
   - Show AI-generated search terms
   - Display 8 GIF options from Tenor
   - Allow creator to select one
3. Preview final puzzle
4. Post to subreddit

#### `game/pages/LeaderboardPage.tsx`
**Purpose**: Display cumulative leaderboard

**Features**:
- Top 20 players by total score
- User stats cards (games played, win rate, best score)
- User's current rank highlight
- Responsive design

### Backend Services

#### `game/server/gameHandler.server.ts`
**Purpose**: Core game CRUD operations

**Key Functions**:
- `saveGame()`: Create and optionally post game to subreddit
- `getGame()`: Retrieve game data by ID
- `getRandomGame()`: Find unplayed game for user
- `saveGameState()` / `getGameState()`: Persist player progress
- `hasUserCompletedGame()`: Check completion status
- `postCompletionComment()`: Auto-comment on game completion

#### `game/server/scoringService.ts`
**Purpose**: Score calculation and leaderboard management

**Key Functions**:
- `calculateScore()`: Apply penalty formula
- `saveScore()`: Persist score and update leaderboards
- `getGameLeaderboard()`: Game-specific rankings
- `getGlobalLeaderboard()`: Best single-game performances
- `getCumulativeLeaderboard()`: Total score rankings
- `getUserScores()`: Individual score history

#### `game/server/autoCreateGameScheduler.ts`
**Purpose**: Automated daily game posting

**Scheduler Job** (`auto_create_post`):
1. Select random category and word/phrase type
2. Request Gemini recommendations
3. Generate progressive hint synonyms
4. Search Tenor for matching GIFs
5. Create masked word (66% letters hidden)
6. Post game to subreddit

**Configuration**:
- Runs on-demand via moderator menu item
- Can be scheduled with cron: `'0 12 * * *'` (daily at 12:00 UTC)

---

## Advanced Features

### 1. Progressive GIF Hints

**Design Philosophy**: Each GIF hint becomes progressively more obvious

**Implementation**:
- Gemini AI generates 4 synonym groups (abstract → direct)
- Creator searches Tenor with each synonym
- Selects most appropriate GIF from 8 options
- Player reveals GIFs sequentially with increasing penalties

### 2. Adaptive Word Hints

**Dynamic System**: Hint availability scales with answer length

**Logic** (in `scoringService.ts::calculateScore()`):
```typescript
if (wordLength >= 5 && wordLength <= 7) {
  hintsAvailable = 1;
  lettersPerHint = 2;
  penaltyPerHint = 50;
} else if (wordLength >= 8 && wordLength <= 10) {
  hintsAvailable = 2;
  lettersPerHint = 2;
  penaltyPerHint = 25;
}
// ... etc
```

**UI Implementation**: Hint button disabled when no hints remaining

### 3. Navigation State Persistence

**Problem**: WebView reloads can lose navigation state

**Solution**:
1. **Primary**: Redis storage (`navState:{postId}`)
2. **Fallback**: localStorage on client
3. **Recovery**: 2-second timeout with cached state

**Flow**:
```
WebView Mounts
    ↓
Send 'requestNavigationState'
    ↓
Server reads Redis → Sends 'SET_NAVIGATION_STATE'
    ↓
Client updates page/gameId
    ↓
[If timeout] Use localStorage fallback
```

### 4. GIF Caching & Media Pipeline

**Three-Layer Caching**:

1. **Query Cache** (`tenor_search:{query}`):
   - Caches search results
   - TTL: 24 hours

2. **Individual GIF Cache** (`tenor_gif:{gifId}`):
   - Stores all formats with Reddit-hosted URLs
   - TTL: 24 hours

3. **Redis-backed Upload**:
   ```typescript
   async function cacheTenorGif(gif) {
     // Check cache
     const cached = await redis.get(`tenor_gif:${gif.id}`);
     if (cached) return cached;
     
     // Upload all formats to Reddit
     for (const format of ['gif', 'mediumgif', 'tinygif', 'nanogif']) {
       const uploaded = await context.media.upload({
         url: gif.media_formats[format].url,
         type: 'gif'
       });
       gif.media_formats[format].url = uploaded.mediaUrl;
     }
     
     // Cache result
     await redis.set(`tenor_gif:${gif.id}`, JSON.stringify(gif), 86400);
     return gif;
   }
   ```

### 5. Automated Game Creation

**Scheduler Configuration**:
```typescript
Devvit.addSchedulerJob({
  name: 'auto_create_post',
  onRun: async (event, context) => {
    // Select random category and type
    const category = pickRandom(['Movies', 'Gaming', 'Books', 'General']);
    const inputType = pickRandom(['word', 'phrase']);
    
    // Generate with AI
    const recommendations = await fetchGeminiRecommendations(context, category, inputType, 10);
    const word = recommendations[0];
    const synonyms = await fetchGeminiSynonyms(context, word);
    
    // Find GIFs
    const gifUrls = [];
    for (const synonymGroup of synonyms.slice(0, 4)) {
      const gifs = await searchTenorGifs(context, synonymGroup[0], 1);
      gifUrls.push(gifs[0].media_formats.tinygif.url);
    }
    
    // Create and post
    await saveGame({
      word,
      maskedWord: generateMaskedWord(word),
      category,
      questionText: `Can you guess the ${inputType}?`,
      gifs: gifUrls,
      postToSubreddit: true
    }, context);
  }
});
```

**Trigger Methods**:
1. Manual: Via moderator menu item "🔁 Test Auto Game Post"
2. Scheduled: Cron job (configured in AppInstall trigger)
3. On-demand: Direct scheduler.runJob() call

---

## Performance Optimizations

### 1. Redis Caching Strategy
- **API responses cached aggressively** (1-24 hours)
- **Daily cache rotation** for variety (day-of-week keys)
- **Shuffle cached results** for perceived freshness
- **Pre-cache common queries** on app install

### 2. Concurrent Operations
```typescript
// Parallel GIF searches
const gifSearches = synonyms.slice(0, 4).map(group => 
  searchTenorGifs(context, group[0], 8)
);
const results = await Promise.all(gifSearches);
```

### 3. Lazy Loading
- **GIFs loaded on demand** as hints are revealed
- **User stats fetched only on leaderboard view**
- **Game state loaded on navigation to game page**

### 4. Optimistic UI Updates
- **Score calculated client-side immediately**
- **Server validation in background**
- **UI doesn't block on server response**

---

## Testing & Debugging

### Debug Logging

**Pattern**:
```typescript
// Critical operations
console.log('[DEBUG-CRITICAL] Description:', data);

// Detailed traces
console.log('[DEBUG-DETAIL] Description:', data);

// Warnings
console.log('[DEBUG-WARN] Description:', data);

// Errors
console.error('[DEBUG-ERROR] Description:', error);
```

**Frontend**: Use browser DevTools console
**Backend**: Use Devvit logs (`devvit logs`)

### Common Issues

1. **WebView not loading**:
   - Check Vite build completed: `npm run build`
   - Verify `webroot/index.html` exists
   - Check browser console for errors

2. **Messages not received**:
   - Add debug logs in `onMessage` handler
   - Verify message type matches exactly
   - Check for typos in postMessage calls

3. **Redis data missing**:
   - Check key format (e.g., `game:{gameId}`)
   - Verify TTL hasn't expired
   - Use Redis CLI via Devvit to inspect

4. **API failures**:
   - Verify API keys configured correctly
   - Check rate limits (Gemini, Tenor)
   - Review cache for stale data

---

## Security Considerations

### API Key Management
- **All keys stored in Devvit settings** (encrypted at rest)
- **Accessed only server-side** via `context.settings.get()`
- **Never exposed to WebView client**

### User Authentication
- **Reddit OAuth handles all auth**
- **Username from `context.reddit.getCurrentUsername()`**
- **No separate authentication system**

### Input Validation
- **Zod schemas** for runtime type validation
- **Server-side guess validation** (trim, lowercase)
- **XSS protection** via React's built-in escaping

### Data Access Control
- **Game answers never sent to client until won**
- **User can only modify own game state**
- **Leaderboards are read-only**

---

## Monitoring & Analytics

### Metrics Tracked

1. **Game Metrics**:
   - Total games created
   - Games played/completed
   - Average completion time
   - Hint usage distribution

2. **User Metrics**:
   - Active players (via leaderboard)
   - Games per user
   - Score distribution
   - Return rate (via lastPlayed timestamp)

3. **System Metrics**:
   - API call success rates
   - Cache hit rates
   - Average response times

### Redis Keys for Analytics
```
activeGames                   # Count: Total games
cumulativeLeaderboard         # Count: Total players
userStats:{username}          # Individual stats
```

### Code Style
- **TypeScript strict mode** enabled
- **Prettier** for formatting (run `npx prettier --write .`)
- **ESLint** configuration (extends Devvit defaults)

### Commit Guidelines
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Reference issue numbers: `feat: add daily challenge (#123)`

### Pull Request Process
1. Fork repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open pull request with detailed description

---

## License

This project is licensed under the BSD-3-Clause License. See `LICENSE` file for details.

---

## Support & Contact

- **Subreddit**: r/PlayGIFEnigma
- **Devvit Docs**: https://developers.reddit.com/docs

---

## Acknowledgments

- **Reddit Devvit Team** for the platform and developer support
- **Google Gemini AI** for intelligent hint generation
- **Tenor API** for extensive GIF library
- **Open Source Community** for the excellent libraries used

---


