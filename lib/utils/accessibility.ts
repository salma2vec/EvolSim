/**
 * Accessibility utilities
 */

/**
 * Generate ARIA label for resource status
 */
export function getResourceAriaLabel(
  resourceName: string,
  amount: number,
  capacity: number,
  collapsed: boolean
): string {
  const percent = Math.round((amount / capacity) * 100);
  
  if (collapsed) {
    return `${resourceName} is collapsed`;
  }
  
  return `${resourceName} at ${percent}% capacity (${amount} of ${capacity})`;
}

/**
 * Generate ARIA label for species status
 */
export function getSpeciesAriaLabel(
  speciesName: string,
  population: number,
  alive: boolean
): string {
  if (!alive) {
    return `${speciesName} is extinct`;
  }
  
  const millions = (population / 1000000).toFixed(2);
  return `${speciesName} with population ${millions} million`;
}

/**
 * Generate ARIA label for event
 */
export function getEventAriaLabel(
  eventType: string,
  message: string,
  timeStep: number
): string {
  return `Epoch ${timeStep}: ${eventType} - ${message}`;
}

/**
 * Check if element should be focusable
 */
export function shouldBeFocusable(interactive: boolean, disabled?: boolean): boolean {
  return interactive && !disabled;
}

