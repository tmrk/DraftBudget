'use strict';

import { Line } from './modules/Line.js';
import { log, setQuietMode } from './modules/log.js';
import { n } from './modules/dom.js';
import { loadRates, saveRatesToLocalStorage } from './modules/fx.js';
import { exposeGlobals } from './modules/globals.js';
import { loadBudget, setRootLine, clearBudget } from './modules/persistence.js';
import { cloneLine } from './modules/serialize.js';

export const createBudget = (varName, options = {}, savedData = null) => {
  log(varName);
  if (!window[varName]) {
    // If we have saved data, reconstruct from it
    if (savedData) {
      window[varName] = cloneLine(savedData);
    } else {
      window[varName] = new Line(options);
    }
    window[varName].appendToBody();
    // Set root line for auto-save
    setRootLine(window[varName]);
    // Also set the alias
    if (varName === 'budget') {
      window.b = window[varName];
    }
  } else log('The variable \'' + varName + '\' is not available. Please choose a different variable name.', 'error');
};

export const addMockData = function (b) {
  if (b && b instanceof Line) {
    setQuietMode(true);
    b.add();
    b.getLine(1).add();
    b.getLine('1.1').add();
    b.getLine('1.1.1').add();
    setQuietMode(false);
    console.log(window.budget);
  }
};

export const start = function () {
  // Expose window API for console access
  exposeGlobals();

  // Load FX rates first
  loadRates();

  window.addEventListener('offline', function (e) {
    log('You\'ve just gone offline.', 'warn');
  });

  window.addEventListener('online', function (e) {
    log('Back online.', 'info');
  });

  document.body.appendChild(n('header', [
    n('h1', 'DraftBudget'),
    n('h2', 'pre-alpha')
  ]));

  // Try to load saved budget data
  const savedData = loadBudget();

  if (savedData) {
    // Restore from saved data
    createBudget('budget', {}, savedData);
    // Fix level classes after reconstruction
    window.budget.refreshLevels();
  } else {
    // Create new budget with mock data
    createBudget('budget', {title: 'My new budget'});
    addMockData(window.budget);
  }

  document.body.appendChild(n('footer', [
    n('span', 'Debug:'),
    n('strong', 'Clear localStorage', {
      click: function () {
        clearBudget();
        localStorage.clear();
        log('Local Storage cleared. Refresh to start fresh.', 'info');
      }
    }),
    n('strong', 'Save rates and symbols to localStorage', {
      click: function () {
        saveRatesToLocalStorage();
      }
    })
  ]));
};
