'use strict';

import { createBudget } from '../start.js';
import { exportToJSON, cloneLine } from './serialize.js';
import { exportToExcel } from './excel.js';
import { convert, prewarmDefault, prewarmAll, ratesByBase, symbols } from './fx.js';
import { config } from './config.js';
import { syslog, log, getQuietMode, setQuietMode } from './log.js';

/**
 * Expose all public APIs on window for console access
 */
export function exposeGlobals() {
  // Functions
  window.createBudget = createBudget;
  window.exportToJSON = exportToJSON;
  window.exportToExcel = exportToExcel;
  window.cloneLine = cloneLine;
  window.convert = convert;
  window.loadRates = prewarmDefault;  // Alias for backwards compat
  window.prewarmAll = prewarmAll;     // Debug action

  // Data (expose by reference so updates reflect)
  Object.defineProperty(window, 'rates', {
    get: () => ratesByBase,
    configurable: true
  });
  Object.defineProperty(window, 'symbols', {
    get: () => symbols,
    configurable: true
  });

  // quietMode via getter/setter (allows window.quietMode = true to work)
  Object.defineProperty(window, 'quietMode', {
    get: getQuietMode,
    set: setQuietMode,
    configurable: true
  });

  window.config = config;
  window.syslog = syslog;
  window.log = log;

  // Note: window.budget and window.b are set by createBudget()
}
