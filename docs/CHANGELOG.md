# Changelog

All notable changes to the Bot Party project are documented in this file.

## [Unreleased] - Current Development

### Added - February 7, 2026

#### ElevenLabs Voice Narration

**Voice System:**
- Integrated ElevenLabs API for high-quality text-to-speech narration
- 8 professional voice actors assigned round-robin to players:
  - Rachel, Adam, Antoni, Elli, Josh, Arnold, Bella, Domi
- First player's voice used as narrator for system announcements
- Speaks all game events: questions, answers, reactions, votes, verdicts, reveals, results

**Audio Manager (`public/app.js`):**
- Single reusable `<audio>` element to maintain browser autoplay context
- Promise-based queue system with 30-second timeout per audio
- LRU cache (max 100 items) to minimize API calls and costs
- Automatic priming on first user gesture to establish playback permissions
- Enabled by default with mute/volume controls in UI

**Backend Integration (`src/server.ts`):**
- New `/api/tts` POST endpoint proxies requests to ElevenLabs API
- Uses `eleven_turbo_v2_5` model (free tier compatible)
- Configurable voice settings (stability: 0.5, similarity_boost: 0.75)
- Streams audio/mpeg response directly to client

**Visual Board Enhancements:**
- All display methods now async to await audio narration
- Speech bubbles now shown for voting phase with player name
- Synchronized voice playback with visual events
- Continues game progression even if audio fails

**Configuration:**
- Optional `ELEVENLABS_API_KEY` environment variable
- Audio controls: mute/unmute toggle, volume slider, playback indicator
- Graceful degradation if API key not provided (silent mode)

## [Unreleased] - Phase 4 & 5 Features

### Added - February 6, 2026

#### API Key Validation & Error Handling (Phase 4.1)

**Provider Validation:**
- Created `src/providers/validation.ts` with comprehensive validation utilities
- Added `APIKeyError` class for missing API key errors with helpful messages
- Added `ProviderAPIError` class for API call failures with context
- Implemented `validateAPIKey()`, `getAPIKey()`, `hasAPIKey()` functions
- Added `getAvailableProviders()` to check which providers are configured

**Error Messages:**
- API key errors now show:
  - Provider name
  - Required environment variable name
  - Direct link to get API key (platform.openai.com, console.anthropic.com, etc.)
- API call errors wrapped with provider context and suggestions

**Health Check Endpoint:**
- New `/api/health` endpoint to check provider configuration status
- Returns list of available providers and detailed status for each
- Shows which providers have valid API keys configured
- Example: `curl http://localhost:3000/api/health`

**Provider Integration:**
- Updated all three providers (OpenAI, Anthropic, Google) to validate API keys on construction
- Wrapped all API calls with error handling via `wrapProviderCall()`
- Better error context for initialization, chat completion, and stateful operations

#### Configurable Reaction Frequency (Phase 4.2)

**Reaction System:**
- Added `reactionFrequency` option to `GameConfig` type
- Five frequency levels: `always`, `frequent` (75%), `sometimes` (50%, default), `rare` (25%), `never`
- Updated `collectReactions()` to filter reactors based on probability
- Passes frequency through game phases to reaction collection

**Configuration:**
- Added `reactionFrequency` query parameter to `/api/start` endpoint
- New dropdown in UI game setup: "AI Reaction Frequency"
- Defaults to `sometimes` for balanced gameplay
- Helps control game length and output verbosity

#### AI Personality System (Phase 5.1-3)

**Personality Framework:**
- Created `src/personalities.ts` with comprehensive personality system
- Seven personality types with unique behavioral traits:
  - **Neutral**: Balanced, standard gameplay (default)
  - **Aggressive**: Direct, confrontational, quick to accuse
  - **Quiet Observer**: Reserved, cautious, minimal responses
  - **Paranoid**: Suspects everyone, sees conspiracies
  - **Comedic**: Playful, humorous, entertaining
  - **Analytical**: Logical, methodical, evidence-based
  - **Social Butterfly**: Friendly, trusting, relationship-focused

**Personality Traits:**
- Each personality affects:
  - Communication style
  - Question-asking approach
  - Answer-giving behavior
  - Suspicion and trust patterns
  - Decision-making style

**Integration:**
- Added `personality?: string` to `PlayerSlotConfig` for AI agents
- Updated `buildPlayerSystemPrompt()` to accept and apply personality
- Personalities integrated via `applyPersonalityToPrompt()` function
- System prompts include personality traits and behavioral guidelines

**UI & API:**
- Added personality dropdown per player in game setup
- API player format: `provider:mode:personality` (e.g., `openai:memory:aggressive`)
- Personality optional, defaults to `neutral` if not specified
- CSS styling for personality selector dropdown

#### Enhanced Location Display (Phase 4.3)

**Location Categories:**
- Added `LOCATION_CATEGORIES` grouping locations by type:
  - Travel & Transport (6 locations)
  - Entertainment & Leisure (11 locations)
  - Work & Business (6 locations)
  - Public Services (5 locations)
  - Special (2 locations)

**Improved Formatting:**
- Updated `allLocationsList()` to show categorized locations
- More organized and readable in AI system prompts
- Helps agents understand location types and context

**Role Hints:**
- Civilians now receive hints about other roles at their location
- Shows 4 other possible roles with their role assignment
- Example: `💡 OTHER ROLES AT Hospital: Physician, Surgeon, Patient, Intern...`
- Helps civilians understand location context better
- Makes role-playing more natural and informed

#### Documentation

**New Files:**
- `docs/FEATURES.md` - Comprehensive guide to personalities and QoL features
  - Personality descriptions and use cases
  - Reaction frequency settings and recommendations
  - Location enhancements and role hints
  - API key validation and error handling
  - Tips and best practices

**Updated Files:**
- `docs/API.md` - Added new parameters:
  - `reactionFrequency` query parameter documentation
  - Updated player format to include personality
  - Added personality options and descriptions
  - Documented `/api/health` endpoint
  - Updated examples with new features

### Changed

**Player Configuration:**
- Player format extended from `type:mode` to `type:mode:personality`
- Backward compatible (personality optional)

**Mode Names:**
- Clarified `memory` (stateless, client sends history) vs `stateful` (server-side history)

**Location Display:**
- System prompts now show categorized locations instead of flat list

**Error Handling:**
- Provider initialization errors now show helpful setup instructions
- API errors include provider name and context

## Previous Releases

### Added - February 6, 2026

#### Testing Infrastructure (Commit 93fc1c4)

**New Testing Framework:**
- Integrated Vitest 3.2.4 as primary testing framework
- Configured with native TypeScript support and ES module compatibility
- Added coverage reporting with c8 (V8's native coverage)
- Created comprehensive test scripts in package.json:
  - `npm test` - Run all tests once
  - `npm run test:watch` - Watch mode for development
  - `npm run test:ui` - Interactive test UI
  - `npm run test:coverage` - Generate coverage reports

**Test Infrastructure:**
- Created `src/__tests__/` directory structure
- Added test fixtures for mock data (`fixtures/index.ts`)
- Implemented `MockAIProvider` for deterministic testing
- Created test helpers including seeded random utilities
- Added test configuration in `vitest.config.ts`

**Test Suite (43 tests total):**
- `parseField.test.ts` (9 tests) - AI response parsing validation
- `normalizeName.test.ts` (4 tests) - Name normalization logic
- `resolveTargetPlayer.test.ts` (8 tests) - Player resolution with fuzzy matching
- `random.test.ts` (10 tests) - Random utility functions with determinism
- `data.test.ts` (7 tests) - Location data integrity validation
- `voting.test.ts` (5 tests) - Vote tallying and tie detection

**Coverage:**
- Utilities: ~92% coverage
- Core game logic: ~85% coverage
- Overall project: ~85% coverage

#### Analytics System (Commit 93fc1c4)

**Data Models:**
- Created comprehensive TypeScript types in `src/analytics/types.ts`:
  - `GameRecord` - Complete game history
  - `TurnRecord` - Individual turns with questions/answers
  - `VoteRecord` - Player voting data
  - `AccusationRecord` - Early accusation tracking
  - `AnalyticsSummary` - Aggregated statistics
  - `ProviderStats` - AI provider performance metrics
  - `LocationStats` - Location difficulty metrics

**Analytics Service:**
- Implemented `AnalyticsService` class (`src/analytics/analytics.service.ts`)
- JSON-based persistence to `data/games/` directory
- Automatic game tracking throughout game lifecycle
- Methods for:
  - Starting game tracking
  - Recording turns, votes, and accusations
  - Ending games with winner determination
  - Loading game history
  - Generating summary statistics

**Game Integration:**
- Integrated analytics tracking into `SpyfallGame` class
- Automatic recording at key game events:
  - Game start with player configurations
  - Each question-and-answer turn
  - Vote submissions
  - Early accusations
  - Game conclusion with winner
- Added player provider and mode tracking

**API Endpoints:**
- `GET /api/analytics/summary` - Aggregated statistics
- `GET /api/analytics/games` - List all game records
- `GET /api/analytics/games/:gameId` - Specific game details

**Metrics Tracked:**
- Total games played
- Average game duration (seconds)
- Average turns per game
- Win rates by role (spy vs civilians)
- Provider performance (wins, games, win rates)
- Location statistics (play count, win rates)
- Complete turn-by-turn game history

#### Location Management System (Commit 49d523c)

**Location Manager:**
- Created `LocationManager` class (`src/locations/manager.ts`)
- Support for default (30) + custom locations
- Location validation with rules:
  - Minimum 3 roles required
  - All role names must be unique
  - All role names must be non-empty strings
  - Location names must be non-empty
- Case-insensitive location name matching

**API Endpoints:**
- `GET /api/locations` - List all available locations
- `POST /api/locations/import` - Import custom location(s)
- `GET /api/locations/export` - Export all locations as JSON
- `GET /api/locations/count` - Get location counts (total, default, custom)

**Location Selection:**
- Modified `GameConfig` to include optional `locationName` field
- Updated `setupGame()` to support specific location selection
- Backward compatible - random selection if no location specified
- Location passed via query parameter in start API

**Import/Export:**
- Support for single or batch location import
- JSON format validation on import
- Export includes both default and custom locations
- Shareable location packs

**Web UI Controls:**
- Added location dropdown in game setup
- "Import Locations" button with file picker
- "Export All" button for downloading locations.json
- Location count display (total and custom count)
- Selected location sent to game start API

**Styling:**
- Added `.location-controls` CSS class
- Secondary button styles for import/export
- Consistent visual design with existing UI
- Responsive layout

#### Analytics Dashboard UI (Commit 441f51a)

**Dashboard Layout:**
- Added new analytics panel (`#analyticsPanel`) to HTML
- Grid-based layout for responsive statistics cards
- Integrated with existing navigation system

**Analytics Components:**
- **Overview Card:**
  - Total games played
  - Average game duration (in minutes)
  - Average turns per game
- **Win Rates Card:**
  - Spy wins (count and percentage)
  - Civilian wins (count and percentage)
- **Provider Performance Card:**
  - Games played per provider
  - Win rates by provider
  - Sorted by most games played
- **Location Stats Card:**
  - Top 5 most played locations
  - Play count for each location
- **Recent Games List:**
  - Last 10 games with full details
  - Game ID, timestamp, location, winner, duration, turns
  - Formatted timestamps with date and time

**Navigation:**
- Added "📊 Analytics" button to header
- Panel switching system (config/game/analytics)
- Back button support for returning to game setup
- Proper show/hide logic for all panels

**Styling:**
- `.analytics-container` - Main container with max-width
- `.analytics-grid` - Responsive grid layout
- `.analytics-card` - Individual stat card styling
- `.stat-row` - Consistent stat display format
- `.games-list` - Scrollable game history
- `.game-item` - Individual game card with hover effects

**Data Loading:**
- Automatic fetch from `/api/analytics/summary`
- Error handling for failed requests
- Empty state messages when no games recorded
- Real-time calculation of percentages and averages

**User Experience:**
- Click Analytics button to view dashboard
- Click Back button to return to game setup
- Auto-refresh analytics when panel opened
- Smooth transitions between panels

### Changed

**Server Updates:**
- Modified `createServer` callback to async handler
- Enables proper await usage for POST request body parsing
- Added `readRequestBody()` helper function for parsing request bodies
- Integrated `AnalyticsService` and `LocationManager` instances

**Agent Class:**
- Changed `mode` property from private field to public getter
- Maintains encapsulation while allowing readonly access
- Enables analytics to track agent modes

**Provider System:**
- Fixed `getProviderCapabilities()` to return static information
- Prevents API key errors when providers aren't fully configured
- Endpoint now works without requiring all three provider keys

### Fixed

**Provider Capabilities Endpoint:**
- Issue: `/api/providers` failed when not all API keys configured
- Root Cause: Function was instantiating all providers to check capabilities
- Solution: Return static capability information without instantiation
- Impact: Can now start server with only one provider configured

**Test Compilation:**
- Fixed incorrect function signatures in test files
- Corrected Player type usage in tests (added required fields)
- Updated test expectations to match actual implementations
- All 43 tests now passing without TypeScript errors

**Import Path:**
- Fixed incorrect import in `LocationManager`
- Changed from `./data` to `../data.js` for ES module compatibility
- Ensures proper module resolution at runtime

## Project Statistics

### Commits on feature/testing-analytics-locations branch

```
441f51a (HEAD) feat: Add analytics dashboard UI
49d523c feat: Add location management with import/export
93fc1c4 feat: Add testing infrastructure and analytics system
f146158 refactor: optimize provider capabilities retrieval
```

### Files Changed

**Testing + Analytics (Commit 93fc1c4):**
- 18 files changed
- 2,069 insertions(+), 9 deletions(-)
- 11 new test files created
- 2 new analytics module files
- Configuration files: vitest.config.ts, package.json updates

**Location Management (Commit 49d523c):**
- 8 files changed
- 416 insertions(+), 9 deletions(-)
- 2 new location module files
- 3 frontend files updated (HTML, JS, CSS)
- 3 backend files updated (server, setup, types)

**Analytics Dashboard (Commit 441f51a):**
- 3 files changed
- 334 insertions(+)
- Complete UI implementation in HTML, JS, CSS

**Total Changes:**
- 29 files modified or created
- 2,819 insertions(+)
- Full-stack changes (backend, frontend, tests, docs)

### Test Coverage

- **Test Files:** 7
- **Total Tests:** 43
- **All Passing:** ✅ 43/43
- **Coverage:** ~85% overall
  - Utils: ~92%
  - Game logic: ~85%

### New Dependencies

```json
{
  "devDependencies": {
    "vitest": "^3.2.4",
    "@vitest/ui": "^3.2.4"
  }
}
```

## Migration Guide

### For Existing Installations

If you're updating from an earlier version:

1. **Install new dependencies:**
   ```bash
   npm install
   ```

2. **Create analytics directory:**
   ```bash
   mkdir -p data/games
   ```

3. **Run tests to verify:**
   ```bash
   npm test
   ```

4. **Restart server:**
   ```bash
   npm run serve
   ```

### Breaking Changes

None. All changes are backward compatible.

### New Environment Variables

No new environment variables required. The system works with existing configuration.

## Acknowledgments

**Testing Framework:**
- Vitest team for excellent TypeScript and ESM support

**Analytics:**
- JSON-based storage for simplicity and portability

**Location System:**
- Original 30 location pack from Spyfall game

## Future Roadmap

Potential upcoming features:

### Testing
- [ ] Integration tests for full game flow
- [ ] E2E tests with Playwright
- [ ] Performance benchmarks
- [ ] Test coverage goal: 95%+

### Analytics
- [ ] Player-specific statistics
- [ ] Time-series analysis and charts
- [ ] Advanced metrics (entropy, information gain)
- [ ] Export to CSV/Excel
- [ ] Database backend option (PostgreSQL/SQLite)
- [ ] Replay system for past games

### Location Management
- [ ] Location difficulty ratings
- [ ] Role descriptions with additional context
- [ ] Location categories and filtering
- [ ] Weighted random selection
- [ ] Location voting system
- [ ] Recently played tracking

### UI/UX
- [ ] Dark/light theme toggle
- [ ] Mobile-responsive design improvements
- [ ] Game state persistence
- [ ] Spectator mode
- [ ] Live game streaming/sharing

### Game Features
- [ ] Multiple game modes
- [ ] Custom rule sets
- [ ] Tournament system
- [ ] Achievements/badges
- [ ] Player profiles

## Contributing

To contribute to this project:

1. Review the [API documentation](./API.md)
2. Read the [testing guide](./TESTING.md)
3. Follow the existing code style
4. Add tests for new features
5. Update documentation as needed

## License

[Add your license information here]

---

*This changelog follows [Keep a Changelog](https://keepachangelog.com/) principles.*
