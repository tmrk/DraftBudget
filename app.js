'use strict';

/* ----- Variables ----- */

let config = {
  roundDecimals: 2,
  showDecimals: 2,
  levelNames: [
    'Budget',
    'Heading',
    'Sub-heading',
    'Activity',
    'Sub-activity'
  ],
  prefix: [
    'R',
    'A'
  ],
  default: {
    currency: 'USD',
    lineColours: [
      'rgba(0,0,0,0.5)',
      'rgba(0,0,0,0.3)',
      'rgba(0,0,0,0.1)',
      'rgba(0,0,0,0.05)'
    ],
    warnBeforeDelete: false
  }
}
let syslog = JSON.parse(localStorage.getItem('syslog')) || [];
let budget;
let b;
let quietMode;
let symbols = {};
let rates = {};

/* ----- Functions ----- */

const fetch = function (base) {
  let request = new XMLHttpRequest();
  let requestURL = base ?
    'https://api.exchangerate.host/latest?base=' + base :
    'https://api.exchangerate.host/symbols';
  request.open('GET', requestURL);
  request.responseType = 'json';
  request.send();
  request.onload = function() {
    if (base) {
      rates[base] = request.response.rates;
    } else {
      symbols = request.response.symbols;
      for (var code in symbols) if (symbols.hasOwnProperty(code)) fetch(code);
    }
  }
}

const convert = function (amount, from, to) {
  from = from.toUpperCase() || config.default.currency.toUpperCase();
  to = to.toUpperCase() || config.default.currency.toUpperCase();
  if (from === to) return amount;
  else if (rates[from]) {
    if (rates[to]) return amount * rates[from][to];
    else return 'No rates found for ' + to;
  }
  else return 'No rates found for ' + from;
}

const columnToLetter = function (column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

const formatN = function (number, showDecimals = config.showDecimals, if0) {
  if (number) {
    let parts = parseFloat(number).toFixed(showDecimals).toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  } else return if0 || 0;
}

const dateISO = function (date) {
  date = date ? new Date(date) : new Date();
  return date.toISOString().split('T')[0];
}

const log = function (message, type, timestamp) {
  type = type || 'log';
  timestamp = timestamp || new Date().getTime();
  syslog.push({
    m: message,
    t: type,
    ts: timestamp
  });
  localStorage.setItem('syslog', JSON.stringify(syslog));
  console[type](message);
}

const loadRates = function () {
  // Only fetch new rates if they're outdated
  if (!localStorage.getItem('rates') ||
      localStorage.getItem('ratesUpdated') <
      new Date().toISOString().split('T')[0]) {
        if (localStorage.getItem('rates')
        && localStorage.getItem('ratesLocked')) {
          log('Exchange rates loaded from cache (locked on '
          + localStorage.getItem('ratesUpdated') + ')');
        } else {
          log('Accessing online exchange rates...');
          fetch();
          setTimeout(function () {
            localStorage.setItem('rates', JSON.stringify(rates));
            localStorage.setItem('symbols', JSON.stringify(symbols));
            localStorage.setItem(
              'ratesUpdated', new Date().toISOString().split('T')[0]
            );
            log('Exchange rates updated ('
            + localStorage.getItem('ratesUpdated') + ')');
          }, 1500); // just a temp fix, should instead wait for fetch to finish
        }
  } else {
    rates = JSON.parse(localStorage.getItem('rates'));
    symbols = JSON.parse(localStorage.getItem('symbols'));
    log('Exchange rates loaded from cache ('
    + localStorage.getItem('ratesUpdated') + ')');
  }
}

const start = function () {
  window.addEventListener('offline', function (e) {
    log('You\'ve just gone offline.', 'warn');
  });

  window.addEventListener('online', function (e) {
    log('Back online.', 'info');
  });

  addMockData();
}

const addMockData = function () {
  quietMode = true;
  b = budget;
  b.add({currency: 'CHF'})
  b.add({currency: 'EUR'})
  b.getLine(1).add()
  b.getLine(1).add({currency: 'CAD'})
  b.getLine(1).getLine(2).add({
    unitCost: 2500,
    start: new Date('2020-01-02').getTime(),
    end: new Date('2024-12-31').getTime()
  })
  b.getLine(1).getLine(2).add();
  b.getLine(2).add();
  b.getLine(2).getLine(1).add({unitCost: 333, currency: 'GBP'});
  b.getLine(2).getLine(1).add({unitCost: 444, currency: 'MXN'});
  b.getLine(2).getLine(1).add({unitCost: 555, currency: 'HKD'});
  quietMode = false;
  console.log(budget);
}

/* ----- Line code ----- */

class Line {

  constructor (options = {}) {
    this.created = this.modified = new Date().getTime();
    for (var v in options) {
      if (options.hasOwnProperty(v) && v !== 'children') this[v] = options[v];
    }
    this.currency = this.currency || config.default.currency;
    if (!this._start) this.start = new Date().getTime();
    if (!this._end) this.end = this._start + 86400000;
  }

  /* --- Setters --- */

  set modified (date) {
    this._modified = date;
  }

  set title (title) {
    this._title = title;
  }

  set start (date) {
    this._start = date;
  }

  set end (date) {
    this._end = date;
  }

  set title (title) {
    this._title = title;
  }

  set currency (currency) {
    this._currency = currency;
  }

  set category (category) {
    if (Array.isArray(category)) this._category = category;
    else this._category = [category];
  }

  /* --- Getters --- */

  get start () {
    let firstStartDate = this.getFirst('_start', true) || this;
    return firstStartDate._start;
  }

  get end () {
    let lastEndDate = this.getLast('_end', true) || this;
    return lastEndDate._end;
  }

  get duration () {
    return this.end - this.start;
  }

  get title () {
    let title = this._title || this.levelName + ' ' + this.lineNumber;
    return title.trim();
  }

  get currency () {
    let currency = this._currency || config.default.currency;
    return currency.substring(0,3).toUpperCase();
  }

  get level () {
    if (this.parent) return this.parent.level + 1;
    else return 0;
  }

  get levelName () {
    return config.levelNames[this.level];
  }

  get category () {
    return this._category || [];
  }

  get lineNumber () {
    return this.level > 0 ? this.parent.children.indexOf(this) + 1 : 1;
  }

  get absLineNumber () {
    let line = this;
    let absLineNumber = 0;
    while (line.before) {
      absLineNumber += 1;
      line = line.before;
    }
    return absLineNumber;
  }

  get index () {
    let index = [];
    let line = this;
    while (line.level > 0) {
      index.unshift(line.lineNumber);
      line = line.parent;
    }
    return index.length ? index.join('.') : 0;
  }

  get root () {
    let root = this;
    while (root.level) root = root.parent;
    return root;
  }

  get parents () {
    let parents = [];
    let current = this;
    while (current.parent) {
      parents.push(current.parent);
      current = current.parent;
    }
    return parents;
  }

  get siblings () {
    let siblings = [];
    for (var i = 0; i < this.parent.children.length; i++) {
      if (this.parent.children[i] !== this) {
        siblings.push(this.parent.children[i]);
      }
    }
    return siblings;
  }

  get descendants () {
    let descendants = [];
    if (this.children) {
      for (var i = 0; i < this.children.length; i++) {
        descendants.push(this.children[i]);
        descendants = descendants.concat(this.children[i].descendants);
      }
    }
    return descendants;
  }

  get before () {
    if (this.lineNumber === 1) return this.parent;
    else {
      let prevSibling = this.parent.getLine(this.lineNumber - 1);
      if (prevSibling.children) {
        return prevSibling.descendants[prevSibling.descendants.length - 1];
      } else return prevSibling;
    }
  }

  get after () {
    if (this.children) return this.children[0];
    else if (this.level && this.parent.children[this.lineNumber]) {
      return this.parent.children[this.lineNumber];
    } else if (this.level) {
      var current = this;
      while (current.level && !current.parent.children[current.lineNumber]) {
        current = current.parent;
      }
      return current.parent.children[current.lineNumber];
    } else return;
  }

  get cost () {
    if (this.unit && this.frequency && this.unitCost) {
      return this.unit * this.frequency * this.unitCost;
    } else return false;
  }

  get total () {
    let total = 0;
    if (this.children) {
      for (var i = 0; i < this.children.length; i++) {
        let base = this.children[i].currency;
        if (this.currency !== base) {
          total += convert(this.children[i].total, base, this.currency);
        } else total += this.children[i].total;
      }
    } else total = this.cost ? this.cost : 0;
    return config.roundDecimals ?
      Number(total.toFixed(config.roundDecimals)) :
      total;
  }

  get currencies () {
    let currencies = [ this.currency ];
    if (!currencies.includes(config.default.currency)) {
      currencies.push(config.default.currency);
    }
    if (this.children) {
      for (var i = 0; i < this.children.length; i++) {
        for (var j = 0; j < this.children[i].currencies.length; j++) {
          if (!currencies.includes(this.children[i].currencies[j])) {
            currencies.push(this.children[i].currencies[j]);
          }
        }
      }
    }
    return currencies.sort();
  }

  /* --- Methods --- */

  add (options = {}, index) {
    let newParent = this;

    // let the child inherit the parent's cost data if any
    options.unit = options.unit || newParent.unit || 1;
    options.frequency = options.frequency || newParent.frequency || 1;
    options.unitCost = options.unitCost || newParent.unitCost || 0;

    // a parent doesn't need these:
    delete this.unit;
    delete this.frequency;
    delete this.unitCost;

    let newLine = new Line(options);
    if (index) {
      if (typeof index === 'string') {
        let map = index.split('.');
        index = Number(map.pop());
        newParent = this.getLine(map.join('.'));
      }
    }
    Object.defineProperty(newLine, 'parent', {
      get: function () { return newParent; }
    });
    if (newParent.children) {
      if (index && index < newParent.children.length) {
        newParent.children.splice(index - 1, 0, newLine);
      } else this.children.push(newLine);
    } else newParent.children = [newLine];
    if (!quietMode) log('New line added ' + newLine.index);
  }

  removeLine (quietMode) {
    let index = this.index;
    let lineNumber = this.lineNumber;
    this.parent.children.splice(lineNumber - 1, 1);
    if (!quietMode) {
      log('Line ' + index + ' deleted', 'info');
    }
  }

  move (newIndex, addAsChild) {
    let oldIndex = this.index;
    let map = addAsChild ? [] : newIndex.toString().split('.');
    let parentIndex = addAsChild ? newIndex : map.slice(0, -1).join('.');
    let newParent = this.root.getLine(parentIndex);
    if (newParent) {
      let clip = JSON.parse(JSON.stringify(this));
      this.removeLine(true);
      newParent.add(clip, map[map.length - 1]);
      log('Line ' + oldIndex + ' moved to line ' + newIndex, 'info');
    }
  }

  recurse (line, callback) {
    callback(line);
    if (line.children) for (var i = 0; i < line.children.length; i++) {
      recurse(line.children[i]);
    }
  }

  getDuration (measure) {
    switch (measure) {
      case 'y':
        return this.duration / 31536000000;
        break;
      case 'm':
        return this.duration / 2628000000;
        break;
      case 'w':
        return this.duration / 604800000;
        break;
      case 'd':
        return this.duration / 86400000;
        break;
      default:
        return this.duration;
    }
  }

  getLine (index) {
    if (!index) return this;
    else if (typeof index === 'number') {
      if (this.children) {
        if (this.children[index - 1]) return this.children[index - 1];
        else console.error('Line ' + this.index + '.' + index + ' does not exist');
      } else console.error('Line ' + this.index + ' does not have any children');
      return false;
    } else {
      let map = index.split('.');
      let line = this;
      for (var i = 0; i < map.length; i++) line = line.getLine(Number(map[i]));
      return line;
    }
  }

  getFirst (property, deepSearch, type) {
    return this.getLast(property, deepSearch, type, true);
  }

  getLast (property = 'created', deepSearch, type = 'children', getFirst) {
    let items = deepSearch ? this.descendants : this[type];
    let map = [];
    for (var i = 0; i < items.length; i++) {
      map.push({
        index: items[i].index,
        property: items[i][property]
      });
    }
    if (map.length) {
      map = map.sort(function (a, b) {
        if (a.property > b.property) return -1;
        if (b.property > a.property) return 1;
        return 0;
      });
      let index = !getFirst ? map[0].index : map[map.length - 1].index;
      return this.root.getLine(index);
    } else return;
  }

  update (options) {
    if (!options || !options.modified) this.modified = new Date().getTime();
    for (var key in options) {
      if (options.hasOwnProperty(key)) {
        this[key] = options[key];
      }
    }
  }

  addCategory (category) {
    if (this._category && Array.isArray(category)) {
      for (var i = 0; i < category.length; i++) {
        this._category.push(category[i]);
      }
    } else this.category = category;
  }

  removeCategory (category) {
    /// TBD
  }

  listCategory (category, line) {
    line = line || this;
    let list = [];

    if (line.category && line.category.includes(category)) {
      list.push(line.index);
    }
    if (line.children) for (var i = 0; i < line.children.length; i++) {
      this.listCategory(category, line.children[i]);
      console.log(line.index)
    }
    return list;
  }

  update (options) {
    if (!options || !options.modified) this.modified = new Date().getTime();
    for (var variable in options) {
      if (options.hasOwnProperty(variable)) {
        this[variable] = options[variable];
      }
    }
  }

}

budget = new Line();

loadRates();

start();
