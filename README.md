# Alien Cooperation Lab

An evolution-first simulator where alien environment and biology mathematically generate social dilemmas, and LLMs govern species to test whether intelligence stabilizes or destroys those derived ecologies.

## Overview

This simulator tests whether increased LLM capability leads to cooperation or collapse in shared ecologies. It generates social dilemmas from first principles (environment → biology → cognition → culture → payoffs) and inserts LLMs only at the decision layer.

## Features

- **Evolution-first world model**: Environment parameters (gravity, volatility, richness) generate species traits
- **LLM-driven decisions**: Each species is controlled by an LLM that makes harvest, diplomatic, and governance decisions
- **Comprehensive metrics**: Tracks collapse probability, cooperation indices, species outcomes, and treaty metrics
- **Interactive UI**: Real-time visualization of resources, populations, and events
- **Multiple presets**: Pre-configured scenarios for testing different configurations

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Add your OPENAI_API_KEY to .env.local
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Select a preset from the dropdown (e.g., "two species simple lake")
2. Click "Run Simulation" to start a simulation
3. Use "Step" to advance one epoch at a time, or "Play" for continuous simulation
4. View metrics, events, and species details in the UI panels

## Architecture

- **Simulation Core** (`lib/sim/`): World generation, dynamics, game loop, metrics
- **LLM Integration** (`lib/llm/`): Prompt building, action parsing, OpenAI client
- **API Routes** (`app/api/`): Simulation and LLM proxy endpoints
- **UI Components** (`components/`): React components for visualization and controls

## Model Profiles

- `small`: GPT-3.5-turbo (baseline)
- `medium`: GPT-4
- `frontier`: GPT-4-turbo
- `frontier_reasoning`: GPT-4-turbo with chain-of-thought

## Research Questions

- Do more capable LLMs learn cooperative long-run policies?
- Or do they use extra reasoning to find more sophisticated ways to strip-mine the commons?
- How does model capability affect collapse probability and average welfare?

## Development

### Running Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Code Quality

```bash
npm run lint
```

### Building for Production

```bash
npm run build
npm start
```

## Recent Improvements

- ✅ Comprehensive error handling and validation
- ✅ TypeScript type safety improvements
- ✅ Structured logging system
- ✅ Error boundaries for React components
- ✅ Export/import functionality
- ✅ Batch experiment runner
- ✅ Enhanced metrics computation
- ✅ Improved treaty interpretation
- ✅ Performance optimizations
- ✅ Accessibility improvements
- ✅ Keyboard shortcuts
- ✅ Theme toggle
- ✅ Comprehensive test suite
- ✅ API documentation

## License

ISC

