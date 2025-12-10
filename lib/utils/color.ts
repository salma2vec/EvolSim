/**
 * Color utilities for visualization
 */

/**
 * Generate color from species ID
 */
export function getSpeciesColor(speciesId: string, index: number): string {
  const colors = [
    "#4A90E2", // Blue
    "#2ECC71", // Green
    "#E74C3C", // Red
    "#F39C12", // Orange
    "#9B59B6", // Purple
    "#1ABC9C", // Teal
    "#E67E22", // Dark Orange
    "#3498DB", // Light Blue
  ];
  
  return colors[index % colors.length];
}

/**
 * Get color for resource health
 */
export function getResourceHealthColor(health: number): string {
  if (health < 0.2) return "#E74C3C"; // Red
  if (health < 0.5) return "#F39C12"; // Orange
  if (health < 0.8) return "#F1C40F"; // Yellow
  return "#2ECC71"; // Green
}

/**
 * Get color for event type
 */
export function getEventColor(eventType: string): string {
  switch (eventType) {
    case "DEFECT":
      return "#E74C3C";
    case "COLLAPSE":
      return "#C0392B";
    case "EXTINCTION":
      return "#7F8C8D";
    case "TREATY":
      return "#3498DB";
    case "DIPLOMACY":
      return "#9B59B6";
    case "CONCLAVE":
      return "#1ABC9C";
    default:
      return "#95A5A6";
  }
}

