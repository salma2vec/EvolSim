/**
 * Custom error classes
 */

export class SimulationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "SimulationError";
  }
}

export class ValidationError extends SimulationError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class LLMError extends SimulationError {
  constructor(message: string, details?: unknown) {
    super(message, "LLM_ERROR", details);
    this.name = "LLMError";
  }
}

export class ResourceError extends SimulationError {
  constructor(message: string, details?: unknown) {
    super(message, "RESOURCE_ERROR", details);
    this.name = "ResourceError";
  }
}

