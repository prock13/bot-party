# Bot Party - Spyfall AI Game Documentation

Bot Party is an AI-powered implementation of the social deduction game **Spyfall**, where AI agents powered by different LLM providers (OpenAI, Anthropic, Google) compete to identify spies or maintain their cover.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Features](#features)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Development](#development)

## Overview

In Spyfall, players are assigned roles at a secret location. One player is the spy who doesn't know the location, while all other players (civilians) share the location knowledge. Through questioning and deduction, players must identify the spy before they deduce the location.

### Key Features

- **Multi-Provider AI Support**: Use OpenAI GPT, Anthropic Claude, or Google Gemini
- **Visual Game Board**: Real-time circular player layout with speech bubbles, animations, and playback controls
- **AI Personalities**: 7 distinct personality types (Aggressive, Quiet, Paranoid, Comedic, Analytical, Social, Neutral)
- **Memory Modes**: Stateful (server-side history) or memory (client-side history) AI agents
- **Configurable Reactions**: Control AI reaction frequency (always, frequent, sometimes, rare, never)
- **Real-time Streaming**: Server-Sent Events (SSE) for live game updates
- **Game Analytics**: Track performance, win rates, and statistics across games
- **Location Management**: Import/export custom location packs with 30+ default locations
- **API Key Validation**: Helpful error messages and health checks for provider configuration
- **Enhanced Location Display**: Categorized locations and role hints for better context
- **Comprehensive Testing**: 43+ tests with Vitest covering core functionality

## Getting Started

### Prerequisites

- Node.js v18+ (v23.2.0 recommended)
- At least one AI provider API key:
  - OpenAI API key
  - Anthropic API key
  - Google AI API key
- Optional: ElevenLabs API key for voice narration (enables text-to-speech)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bot-party
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

4. Start the development server:
   ```bash
   npm run serve
   ```

5. Open your browser to `http://localhost:3000`

### Environment Variables

Create a `.env` file with the following keys:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
ELEVENLABS_API_KEY=sk_...  # Optional - for voice narration
PORT=3000
```

**Note**: You only need to configure the API keys for providers you want to use. The `ELEVENLABS_API_KEY` is optional but enables high-quality voice narration for gameplay.

## Features

### 🎮 Game Setup

- **Player Configuration**: Mix AI agents and human players (2-8 players)
- **AI Provider Selection**: Choose between OpenAI GPT, Anthropic Claude, or Google Gemini
- **AI Personalities**: Assign unique personalities to each AI agent:
  - **Aggressive**: Direct and confrontational
  - **Quiet Observer**: Reserved and cautious
  - **Paranoid**: Suspects everyone
  - **Comedic**: Playful and humorous
  - **Analytical**: Logical and methodical
  - **Social Butterfly**: Friendly and trusting
  - **Neutral**: Balanced (default)
- **Memory Modes**: 
  - **Memory**: Client sends full history each turn
  - **Stateful**: Server manages conversation history
- **Reaction Frequency**: Control how often AI agents react to Q&A
  - Always, Frequent, Sometimes (default), Rare, Never
- **Custom Rounds**: Set the number of question rounds (1-30)
- **Location Selection**: Choose specific locations or random
- **Early Voting**: Allow players to make accusations during the game

### 🎭 AI Personalities

Each AI agent can have a distinct personality affecting their:
- **Questioning style**: How they ask questions (aggressive vs subtle)
- **Answering approach**: How they respond (brief vs detailed)
- **Suspicion behavior**: How they react to others (paranoid vs trusting)
- **Decision-making**: How they make accusations (bold vs cautious)

Mix and match personalities for unique gameplay dynamics! See [FEATURES.md](docs/FEATURES.md) for detailed personality descriptions.

### 🎨 Visual Game Board

Real-time visual representation of the game with:

- **Player Cards**: Circular layout showing all players with avatars and status
- **Speech Bubbles**: Questions and answers appear near the speaking player
- **Turn Indicators**: Visual highlighting of the current asker and target
- **Round Tracking**: Live round counter showing progress through the game
- **Voting Visualization**: Vote counts displayed on player cards
- **Spy Reveal**: Dramatic reveal animation at game end
- **Result Display**: Winner announcement with icons and styling
- **Playback Controls**: Adjust visualization speed (0.5x to 4x) or pause
- **Voice Narration**: High-quality text-to-speech powered by ElevenLabs API
  - Each player assigned unique voice from 8 professional voice actors
  - Speaks all questions, answers, reactions, votes, and game announcements
  - Volume control and mute toggle
  - Enabled by default with automatic browser compatibility handling
  - Intelligent caching to minimize API usage and costs
  - 30-second timeout to prevent game hanging on audio issues

Toggle between the classic log view and visual board using the view selector in the game panel.

### 📊 Analytics Dashboard

Track comprehensive game statistics including:

- **Game Metrics**: Total games, average duration, average turns
- **Win Rates**: Spy vs civilian success rates with percentages
- **Provider Performance**: Win rates by AI provider (GPT, Claude, Gemini)
- **Location Stats**: Most played locations and their win rates
- **Recent Games**: View detailed history of recent matches with full game data

Access analytics by clicking the **📊 Analytics** button in the header.

### 🗺️ Location Management

- **30 Default Locations**: Pre-configured locations with 7-8 roles each
- **Custom Locations**: Import custom location packs
- **Location Selection**: Choose specific locations or randomize
- **Import/Export**: Share location packs as JSON files

### 🧪 Testing Infrastructure

- **Vitest Framework**: Modern testing with native TypeScript support
- **43+ Tests**: Comprehensive coverage of utilities and game logic
- **Mock Providers**: Deterministic AI response testing
- **Coverage Reports**: Track code coverage with c8

## Architecture

### Tech Stack

- **Runtime**: Node.js with ES modules
- **Language**: TypeScript 5.9.3 (strict mode)
- **Server**: Node HTTP + Server-Sent Events (SSE)
- **Testing**: Vitest 3.2.4 with coverage
- **AI SDKs**: OpenAI, Anthropic, Google Generative AI

### Project Structure

```
bot-party/
├── src/
│   ├── agent.ts              # AI agent wrapper
│   ├── game.ts               # Main game orchestrator
│   ├── server.ts             # HTTP + SSE server
│   ├── types.ts              # Core type definitions
│   ├── data.ts               # Location data (30 locations)
│   ├── prompts.ts            # AI prompt templates
│   ├── analytics/            # Analytics system
│   │   ├── types.ts          # Analytics data models
│   │   ├── analytics.service.ts  # Core analytics service
│   │   └── index.ts          # Module exports
│   ├── locations/            # Location management
│   │   ├── manager.ts        # LocationManager class
│   │   └── index.ts          # Module exports
│   ├── providers/            # AI provider integrations
│   │   ├── openai.provider.ts
│   │   ├── anthropic.provider.ts
│   │   ├── google.provider.ts
│   │   └── index.ts
│   ├── controllers/          # Player controllers
│   │   ├── ai.controller.ts  # AI player logic
│   │   ├── human.controller.ts  # Human player input
│   │   └── player.controller.ts  # Base controller
│   ├── phases/               # Game phases
│   │   ├── setup.ts          # Player assignment
│   │   ├── questionRounds.ts # Question phase
│   │   ├── voting.ts         # Voting phase
│   │   ├── accusation.ts     # Accusation handling
│   │   └── reactions.ts      # Final reactions
│   └── __tests__/            # Test suite
│       ├── fixtures/         # Test data
│       ├── mocks/            # Mock providers
│       └── helpers.ts        # Test utilities
├── public/
│   ├── index.html            # Web UI
│   ├── app.js                # Frontend JavaScript
│   └── styles.css            # CSS styles
├── data/
│   └── games/                # Analytics JSON storage
├── docs/                     # Documentation
└── package.json
```

## Documentation

- **[API Reference](./docs/API.md)** - HTTP endpoints and response formats
- **[Testing Guide](./docs/TESTING.md)** - How to write and run tests
- **[Analytics System](./docs/ANALYTICS.md)** - Analytics data models and usage
- **[Location Management](./docs/LOCATIONS.md)** - Custom location pack format
- **[Changelog](./docs/CHANGELOG.md)** - Recent changes and improvements

## Development

### Available Scripts

```bash
# Start development server
npm run serve

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Build TypeScript
npm run build
```

### Adding New Locations

Create a JSON file with the following format:

```json
{
  "name": "Space Station",
  "roles": [
    "Commander",
    "Engineer",
    "Scientist",
    "Doctor",
    "Security Officer",
    "Communications Officer",
    "Maintenance Crew"
  ]
}
```

Import via the UI or:

```bash
curl -X POST http://localhost:3000/api/locations/import \
  -H "Content-Type: application/json" \
  -d @space-station.json
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Commit your changes: `git commit -m "feat: add my feature"`
7. Push to your fork: `git push origin feature/my-feature`
8. Create a Pull Request

## Game Rules

### Setup Phase
1. Players are assigned to a secret location
2. One player is randomly selected as the spy
3. All civilians know the location and their role
4. The spy knows they're the spy but not the location

### Question Rounds
- Players take turns asking questions to others
- Questions should help deduce who the spy is (for civilians) or what the location is (for spy)
- Players respond based on their knowledge
- Optional: Players can make early accusations

### Voting Phase
- All players vote on who they believe is the spy
- Majority vote determines the accused

### Game End
- **Civilians Win**: If they correctly identify the spy
- **Spy Wins**: If spy survives and correctly guesses the location
- **Draw**: If spy survives but guesses wrong

## License

[Add your license here]

## Credits

Built with ❤️ using modern AI language models and TypeScript.
