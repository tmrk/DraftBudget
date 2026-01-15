'use strict';

import { config } from './config.js';
import { log } from './log.js';

// === FX State ===
export let ratesByBase = {};  // { USD: { fetchedAt, rates }, EUR: { fetchedAt, rates }, ... }
export let symbols = {};      // { USD: "United States Dollar", EUR: "Euro", ... }

// In-flight tracking and debounce
const inFlight = new Set();
let pendingRerender = null;

// Constants
const API_BASE = 'https://api.frankfurter.dev/v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RERENDER_DEBOUNCE_MS = 100;

// === Cache Management ===

/**
 * Load cache from localStorage and migrate old keys
 */
export function loadCache() {
  // Migration: clear old keys from previous FX implementation
  localStorage.removeItem('rates');
  localStorage.removeItem('ratesUpdated');
  localStorage.removeItem('ratesLocked');

  try {
    const cached = localStorage.getItem('ratesByBase');
    if (cached) ratesByBase = JSON.parse(cached);
    const cachedSymbols = localStorage.getItem('symbols');
    if (cachedSymbols) symbols = JSON.parse(cachedSymbols);
  } catch (e) {
    log('Failed to load FX cache: ' + e.message, 'warn');
  }
}

/**
 * Save cache to localStorage
 */
export function saveCache() {
  try {
    localStorage.setItem('ratesByBase', JSON.stringify(ratesByBase));
    localStorage.setItem('symbols', JSON.stringify(symbols));
  } catch (e) {
    log('Failed to save FX cache: ' + e.message, 'warn');
  }
}

/**
 * Check if cache for base is valid (fetched within TTL)
 */
function isCacheValid(base) {
  if (!ratesByBase[base]?.fetchedAt) return false;
  return (Date.now() - ratesByBase[base].fetchedAt) < CACHE_TTL_MS;
}

/**
 * Debounce re-render to avoid repeated update loops
 */
function scheduleRerender(callback) {
  if (pendingRerender) clearTimeout(pendingRerender);
  pendingRerender = setTimeout(() => {
    pendingRerender = null;
    callback();
  }, RERENDER_DEBOUNCE_MS);
}

// === API Functions ===

/**
 * Fetch rates for a specific base currency
 */
export async function fetchRatesForBase(base, onComplete) {
  // Skip if already in-flight for this base
  if (inFlight.has(base)) return null;

  inFlight.add(base);
  try {
    const response = await fetch(`${API_BASE}/latest?base=${base}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    ratesByBase[base] = {
      fetchedAt: Date.now(),
      rates: { ...data.rates, [base]: 1 }  // Include self-rate
    };
    saveCache();
    log(`Exchange rates loaded for ${base}`);

    // Debounced re-render callback
    if (typeof onComplete === 'function') {
      scheduleRerender(onComplete);
    }

    return ratesByBase[base];
  } catch (error) {
    log(`Failed to fetch rates for ${base}: ${error.message}`, 'error');
    return null;
  } finally {
    inFlight.delete(base);
  }
}

/**
 * Fetch currency list
 */
export async function fetchCurrencies() {
  try {
    const response = await fetch(`${API_BASE}/currencies`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    symbols = await response.json();
    saveCache();
    log('Currency list loaded');
  } catch (error) {
    log(`Failed to fetch currencies: ${error.message}`, 'error');
  }
}

// === Conversion ===

/**
 * Convert amount from one currency to another
 * DIRECT RATES ONLY - never falls back to cross-rate
 * Returns NaN and triggers async fetch if rate is missing
 */
export function convert(amount, from, to, onRatesLoaded) {
  from = (from || config.default.currency).toUpperCase();
  to = (to || config.default.currency).toUpperCase();

  if (from === to) return amount;

  // ONLY use direct rates from the source base - NO cross-rate fallback
  if (ratesByBase[from]?.rates?.[to] !== undefined) {
    return amount * ratesByBase[from].rates[to];
  }

  // Missing rate - trigger async fetch (with in-flight guard) and return NaN
  if (!isCacheValid(from) && !inFlight.has(from)) {
    fetchRatesForBase(from, onRatesLoaded);
  }

  return NaN;
}

// === Initialization ===

/**
 * Prewarm default currency at startup
 */
export async function prewarmDefault(defaultCurrency) {
  defaultCurrency = defaultCurrency || config.default.currency;
  loadCache();
  await fetchCurrencies();

  if (!isCacheValid(defaultCurrency)) {
    await fetchRatesForBase(defaultCurrency);
  }
}

/**
 * Debug action: prewarm all bases (sequential to avoid rate limiting)
 */
export async function prewarmAll() {
  await fetchCurrencies();
  const currencies = Object.keys(symbols);
  log(`Prewarming rates for ${currencies.length} currencies...`);
  for (const base of currencies) {
    if (!isCacheValid(base)) {
      await fetchRatesForBase(base);
    }
  }
  log('All rates prewarmed');
}

// === Legacy API compatibility ===

/**
 * loadRates - legacy function name, maps to prewarmDefault
 */
export const loadRates = prewarmDefault;

/**
 * saveRatesToLocalStorage - legacy function name
 */
export const saveRatesToLocalStorage = saveCache;

// Legacy: expose rates as getter that returns ratesByBase for backwards compat
// (The actual window.rates will be set up in globals.js)
