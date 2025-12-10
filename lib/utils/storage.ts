/**
 * Local storage utilities with error handling
 */

/**
 * Safe localStorage get
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`Failed to get storage item ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Safe localStorage set
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to set storage item ${key}:`, error);
    return false;
  }
}

/**
 * Remove storage item
 */
export function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove storage item ${key}:`, error);
  }
}

/**
 * Clear all storage
 */
export function clearStorage(): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.clear();
  } catch (error) {
    console.warn("Failed to clear storage:", error);
  }
}

