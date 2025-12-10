/**
 * String utility functions
 */

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert snake_case to Title Case
 */
export function snakeToTitle(str: string): string {
  return str
    .split("_")
    .map(word => capitalize(word))
    .join(" ");
}

/**
 * Convert camelCase to Title Case
 */
export function camelToTitle(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .split(" ")
    .map(word => capitalize(word))
    .join(" ");
}

/**
 * Pad string to fixed width
 */
export function pad(str: string, width: number, char: string = " "): string {
  if (str.length >= width) return str;
  return str + char.repeat(width - str.length);
}

/**
 * Remove whitespace
 */
export function removeWhitespace(str: string): string {
  return str.replace(/\s+/g, "");
}

