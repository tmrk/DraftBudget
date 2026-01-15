'use strict';

import { config } from './config.js';

/**
 * Node generator
 * Syntax: n('tag#id.class|attribute=value', content/[content], {'event': function() {...}})
 */
export const n = (tag, content, listener) => {
  let el = document.createElement(tag.split('#')[0].split('.')[0].split('|').shift() || 'div');
  if (tag.split('#')[1]) el.id = tag.split('#')[1].split('.')[0].split('|')[0];
  if (tag.split('.')[1]) el.classList.add(...tag.split('.').slice(1).join('.').split('|')[0].split('.'));
  if (tag.split('|')[1]) {
    let attrTemp = tag.split('|').slice(1);
    for (let i = 0; i < attrTemp.length; i++) el.setAttribute(attrTemp[i].split('=')[0], attrTemp[i].split('=')[1]);
  }
  if (content) {
    if (typeof content === 'string' || typeof content === 'number') {
      el.insertAdjacentHTML('beforeend', content);
    }
    else if (content.constructor === Array) for (let i = 0; i < content.length; i++) {
      if (typeof content === 'string' || typeof content === 'number') {
        el.insertAdjacentHTML('beforeend', content[i]);
      } else el.appendChild(content[i]);
    }
    else el.appendChild(content);
  }
  if (listener) for (let event in listener) if (listener.hasOwnProperty(event)) el.addEventListener(event, listener[event]);
  return el;
};

export const columnToLetter = function (column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
};

export const formatN = function (number, showDecimals = config.showDecimals, if0) {
  if (number) {
    let parts = parseFloat(number).toFixed(showDecimals).toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  } else return if0 || 0;
};

export const dateISO = function (date) {
  date = date ? new Date(date) : new Date();
  return date.toISOString().split('T')[0];
};
