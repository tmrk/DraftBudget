'use strict';

import { log } from './log.js';

const STORAGE_KEY = 'budgetData';
const DEBOUNCE_MS = 500;

let saveTimeout = null;
let rootLine = null;

/**
 * Set the root line reference for auto-save
 */
export function setRootLine(line) {
  rootLine = line;
}

/**
 * Get the root line reference
 */
export function getRootLine() {
  return rootLine;
}

/**
 * Save budget data to localStorage (debounced)
 */
export function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveBudget();
  }, DEBOUNCE_MS);
}

/**
 * Save budget data to localStorage immediately
 */
export function saveBudget() {
  if (!rootLine) return;

  try {
    // Import dynamically to avoid circular dependency
    import('./serialize.js').then(({ exportToJSON }) => {
      const data = exportToJSON(rootLine, true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      log('Budget saved to localStorage');
    });
  } catch (e) {
    log('Failed to save budget: ' + e.message, 'error');
  }
}

/**
 * Load budget data from localStorage
 * Returns the saved data object or null if none exists
 */
export function loadBudget() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      log('Budget loaded from localStorage');
      return data;
    }
  } catch (e) {
    log('Failed to load budget: ' + e.message, 'error');
  }
  return null;
}

/**
 * Clear saved budget data
 */
export function clearBudget() {
  localStorage.removeItem(STORAGE_KEY);
  log('Budget data cleared from localStorage');
}
