'use strict';

export let syslog = [];

// Initialize from localStorage if available
try {
  const stored = localStorage.getItem('syslog');
  if (stored) syslog = JSON.parse(stored);
} catch (e) {
  // Ignore parse errors
}

let _quietMode = false;

export function getQuietMode() {
  return _quietMode;
}

export function setQuietMode(value) {
  _quietMode = !!value;
}

// For backwards compatibility, export as a mutable binding
export { _quietMode as quietMode };

export const log = function (message, type, timestamp) {
  type = type || 'log';
  timestamp = timestamp || new Date().getTime();
  syslog.push({
    m: message,
    t: type,
    ts: timestamp
  });
  // localStorage.setItem('syslog', JSON.stringify(syslog));
  console[type](message);
};
