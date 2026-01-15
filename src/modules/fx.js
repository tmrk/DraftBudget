'use strict';

import { config } from './config.js';
import { log } from './log.js';
import { dateISO } from './dom.js';

// FX state - will be replaced with Frankfurter in next commit
export let symbols = {};
export let rates = {};

export const saveRatesToLocalStorage = () => {
  localStorage.setItem('rates', JSON.stringify(rates));
  localStorage.setItem('symbols', JSON.stringify(symbols));
  localStorage.setItem(
    'ratesUpdated', new Date().toISOString().split('T')[0]
  );
  log('Exchange rates updated ('
    + localStorage.getItem('ratesUpdated') + ')');
};

const fetchData = async base => {
  const requestURL = base ?
    'https://api.exchangerate.host/latest?base=' + base :
    'https://api.exchangerate.host/symbols';
  await fetch(requestURL)
    .then(response => response.json())
    .then(response => {
      if (base) {
        rates[base] = response.rates;
      } else {
        symbols = response.symbols;
        for (let code in symbols) fetchData(code);
      }
    })
    .then(response => {
      saveRatesToLocalStorage();
    });
};

export const loadRates = function (forceRefresh) {
  // Only fetch new rates if they're outdated or if a refresh is forced
  if (!localStorage.getItem('rates') ||
      localStorage.getItem('ratesUpdated') < dateISO(new Date()) ||
      forceRefresh) {
    if (localStorage.getItem('rates')
        && localStorage.getItem('ratesLocked')) {
      log('Exchange rates loaded from cache (locked on '
        + localStorage.getItem('ratesUpdated') + ')');
    } else {
      log('Accessing online exchange rates...');
      fetchData();
    }
  } else {
    rates = JSON.parse(localStorage.getItem('rates'));
    symbols = JSON.parse(localStorage.getItem('symbols'));
    log('Exchange rates loaded from cache ('
      + localStorage.getItem('ratesUpdated') + ')');
  }
};

export const convert = function (amount, from, to) {
  from = (from || config.default.currency).toUpperCase();
  to = (to || config.default.currency).toUpperCase();
  if (from === to) return amount;
  else if (rates[from]) {
    if (rates[from][to]) return amount * rates[from][to];
    else return NaN; // Changed from string to NaN per requirements
  }
  else return NaN; // Changed from string to NaN per requirements
};
