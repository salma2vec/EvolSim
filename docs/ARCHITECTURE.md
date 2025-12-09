# EvolSim Architecture Documentation

## Overview

EvolSim is an evolution-first simulator where alien environments and biology mathematically generate social dilemmas, and LLMs govern species to test whether intelligence stabilizes or destroys derived ecologies.

## System Architecture

### Core Components

#### 1. Simulation Engine (`lib/sim/`)

- **types.ts**: Core type definitions for world state, species, resources, events
- **dynamics.ts**: Resource and population update logic using logistic growth models
- **gameLoop.ts**: Main epoch step function, event detection, treaty processing
- **worldGen.ts**: Planet and species generation from presets
- **presets.ts**: Pre-configured simulation scenarios
- **metrics.ts**: Computation of cooperation indices, collapse stats, outcomes
- **language.ts**: Linguistic regime constraints and treaty interpretation
- **orders.ts**: Epistemic order mechanics (contact windows, decision intervals)
- **random.ts**: Seeded random number generator for reproducibility

#### 2. LLM Integration (`lib/llm/`)

- **client.ts**: OpenAI API wrapper with fallback mocks
- **promptBuilder.ts**: Natural language prompt generation for species decisions
- **parseActions.ts**: Parse LLM JSON responses into structured decisions

#### 3. API Routes (`app/api/`)

- **simulate/route.ts**: Main simulation endpoint
- **llm/route.ts**: LLM proxy endpoint
- **batch/route.ts**: Batch experiment runner
- **export/route.ts**: Simulation data export

#### 4. UI Components (`components/`)

- **WorldControls.tsx**: Play/pause/step controls, preset selector
- **WorldSummary.tsx**: Planet metrics and resource levels
- **SpeciesList.tsx**: Species overview with health status
- **RetroTileMap.tsx**: Canvas-based world visualization
- **ResourceTimeline.tsx**: Resource levels over time
- **PopulationTimeline.tsx**: Species populations over time
- **CooperationMetrics.tsx**: Cooperation index visualization
- **EventLog.tsx**: Scrollable event history
- **ExperimentPanel.tsx**: Experiment configuration
- **SpeciesDetailDrawer.tsx**: Detailed species information
- **ErrorBoundary.tsx**: React error boundary
- **LoadingSpinner.tsx**: Loading indicator
- **ErrorMessage.tsx**: Error display component

#### 5. Utilities (`lib/utils/`)

- **validation.ts**: Input validation for API requests and data
- **logger.ts**: Structured logging utility
- **export.ts**: Simulation data export/import
- **batch.ts**: Batch experiment runner

#### 6. Configuration (`lib/config.ts`)

Centralized constants for simulation parameters, resource limits, species bounds, etc.

## Data Flow

1. **Initialization**: User selects preset → `createWorldFromPreset()` → Initial world state
2. **Simulation Loop**: 
   - Build observations for each species
   - Generate LLM prompts
   - Get decisions from LLM
   - Process treaties
   - Update resources and populations
   - Detect events
   - Store in history
3. **Visualization**: History → React components → UI updates

## Key Algorithms

### Resource Dynamics
- Logistic growth: `R_{t+1} = max(0, R_t + g*R_t*(1-R_t/K) - harvest + noise)`
- Collapse when amount < threshold

### Population Dynamics
- Exponential growth/decline: `N_{t+1} = N_t * exp(a*resource - b*stress)`
- Extinction when population < 1000

### Cooperation Index
- Tracks defections, treaty violations, and adherence
- Combines penalties and bonuses for final score (0-1)

## Extension Points

- Add new presets in `presets.ts`
- Add new linguistic regimes in `language.ts`
- Add new epistemic orders in `orders.ts`
- Add new metrics in `metrics.ts`
- Add new UI components in `components/`

