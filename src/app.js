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
      'rgba(255,255,255,0.1)',
      'rgba(255,255,255,0.2)',
      'rgba(255,255,255,0.3)',
      'rgba(255,255,255,0.4)',
      'rgba(255,255,255,0.5)'
    ],
    warnBeforeDelete: false
  }
}
let syslog = JSON.parse(localStorage.getItem('syslog')) || [];
let quietMode;
let symbols = {};
let rates = {};

/* ----- Functions ----- */

// Node generator, syntax: n('tag#id.class|attribute=value', content/[content], {'event': function() {...})
const n = (tag, content, listener) => {
  var el = document.createElement(tag.split('#')[0].split('.')[0].split('|').shift());
  if (tag.split('#')[1]) el.id = tag.split('#')[1].split('.')[0].split('|')[0];
  if (tag.split('.')[1]) el.classList.add(...tag.split('.').slice(1).join('.').split('|')[0].split('.'));
  if (tag.split('|')[1]) {
      var attrTemp = tag.split('|').slice(1);
      for (var i = 0; i < attrTemp.length; i++) el.setAttribute(attrTemp[i].split('=')[0], attrTemp[i].split('=')[1]);
  }
  if (content) {
      if (typeof content === 'string' || typeof content === 'number') {
        el.insertAdjacentHTML('beforeend', content);
      }
      else if (content.constructor === Array) for (var i = 0; i < content.length; i++) {
          if (typeof content === 'string' || typeof content === 'number') {
            el.insertAdjacentHTML('beforeend', content[i]);
          } else el.appendChild(content[i]);
      }
      else el.appendChild(content);
  }
  if (listener) for (var event in listener) if (listener.hasOwnProperty(event)) el.addEventListener(event, listener[event]);
  return el;
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
  //localStorage.setItem('syslog', JSON.stringify(syslog));
  console[type](message);
}

const saveRatesToLocalStorage = () => {
  localStorage.setItem("rates", JSON.stringify(rates));
  localStorage.setItem("symbols", JSON.stringify(symbols));
  localStorage.setItem(
    "ratesUpdated", new Date().toISOString().split('T')[0]
  );
  log("Exchange rates updated ("
  + localStorage.getItem("ratesUpdated") + ")");
};

const fetchData = async base => {
  const requestURL = base ?
    "https://api.exchangerate.host/latest?base=" + base :
    "https://api.exchangerate.host/symbols";
  await fetch(requestURL)
    .then(response => response.json())
    .then(response => {
      if (base) {
        rates[base] = response.rates;
      } else {
        symbols = response.symbols;
        for (var code in symbols) fetchData(code);
      }
    })
    .then(response => {
      saveRatesToLocalStorage();
    });
}

const loadRates = function (forceRefresh) {
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
}

const start = function () {
  window.addEventListener('offline', function (e) {
    log('You\'ve just gone offline.', 'warn');
  });

  window.addEventListener('online', function (e) {
    log('Back online.', 'info');
  });

  const viewExport = n("div#export", [
    n("span", "Show current data", {click: () => {
      document.getElementById("exportoutput").classList.toggle("hidden");
    }}),
    n("pre#exportoutput.hidden")
  ]);

  document.body.appendChild(n("header", [
    n("span", "Debug:"),
    n("strong", "Clear localStorage", {
      click: function () {
        localStorage.clear();
        log("Local Storage cleared.", "info")
      }
    }),
    n("strong", "Save rates and symbols to localStorage", {
      click: function () {
        saveRatesToLocalStorage();
      }
    })
  ]));

  //document.body.appendChild(viewExport);
  createBudget("budget")
  addMockData(budget);

  document.body.appendChild(n("footer", [
    n("p", "Refresh the page if the above table is empty!</br>(The exchange rate loader script is not working properly yet.)")
  ]));
}

const addMockData = function (b) {
  if (b && b instanceof Line) {
    quietMode = true;
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
    b.getLine(2).getLine(1).add({unitCost: 333, unitType: "pcs", currency: 'GBP'});
    b.getLine(2).getLine(1).add({unitCost: 444, currency: 'MXN'});
    b.getLine(2).getLine(1).add({unitCost: 555, currency: 'HKD'});
    b.viewUpdate("down");
    quietMode = false;
    console.log(budget);
  }
}

const exportJSON = (data, targetID) => {
  const dataString = JSON.stringify(data, 2, 2);
  const target = document.getElementById(targetID);
  if (target) target.textContent = dataString;
};

const createBudget = (varName, options = {}) => {
  log(varName);
  if (!window[varName]) {
    window[varName] = new Line(options);
    window[varName].appendToBody();
  } else log("The variable \"" + varName + "\" is not available. Please choose a different variable name.", "error");
};

const cloneLine = (line) => {
  const clone = (typeof line === "string") ? JSON.parse(line) : line;
  const newLine = new Line();
  if (clone.children && clone.children.length) {
    for (let i = 0; i < clone.children.length; i++) {
      const cloneChild = clone.children[i];
      newLine.addLine(cloneLine(cloneChild));
    }
  }
  for (let property in clone) {
    if (clone.hasOwnProperty(property) && clone[property]) {
      if ([
        "created"
      ].includes(property)) {
        newLine[property] = clone[property];
      } else if ([
        "_modified", "_currency", "_start", "_end",  "_title", "_unitNumber",
        "_unitType", "_unitCost", "_frequency"
      ].includes(property)) {
        newLine[property.replace("_", "")] = clone[property];
      }
    }
  }
  return newLine;
}

/* ----- Line code ----- */

class Line {

  constructor (options = {}) {
    let buttonDelete = n('span.button.delete',
      n('span', 'Delete'),
      {click: function () {
          this.remove();
        }.bind(this)
      }
    );
    let buttonAdd = n("span.button.add",
      n("span", "Add Subline"),
      {click: function () {
          this.add();
        }.bind(this)
      }
    );
    this.viewProps = {
      index: n('div.col1.index', n("span", this.index)),
      title: n('div.col2.title.editable', n("span", this.title)),
      unitNumber: n('div.col3.unitnumber.editable', n("span", this.unitNumber)),
      unitType: n('div.col4.unittype.editable', n("span", this.unitType)),
      unitCost: n('div.col5.unitcost.alignright.editable', n("span", formatN(this.unitCost))),
      frequency: n('div.col6.frequency.alignright.editable', n("span", this.frequency)),
      cost: n('div.col7.cost.alignright', n("span", formatN(this.cost))),
      total: n('div.col8.total.alignright', n("span", formatN(this.total))),
      currency: n('div.col9.currency.editable', n("span", this.currency)),
      tools: n('div.col10.tools', [ buttonDelete, buttonAdd ])
    };

    this.created = this.created || new Date().getTime();
    this.modified = this.modified || this.created;
    for (var v in options) {
      if (options.hasOwnProperty(v) && v !== 'children') this[v] = options[v];
    }
    this.currency = this.currency || config.default.currency;
    if (!this._start) this.start = new Date().getTime();
    if (!this._end) this.end = this._start + 86400000;

    const viewProps = n("div.props", [
      this.viewProps.index,
      this.viewProps.title,
      this.viewProps.unitNumber,
      this.viewProps.unitType,
      this.viewProps.unitCost,
      this.viewProps.frequency,
      this.viewProps.cost,
      this.viewProps.total,
      this.viewProps.currency,
      this.viewProps.tools
    ]);
    this.viewChildren = n("ul");

    for (var property in this.viewProps) {
      const propNode = this.viewProps[property];
      propNode.setAttribute("data-property", property);
      if (propNode.classList.contains("editable")) {

        /* Clicking on line properties to edit them */
        propNode.addEventListener("click", function () {
          if (!propNode.getElementsByTagName("input").length) {
            const previousEditing = this.root.view.querySelector(".editing input");
            const pressEnter = new KeyboardEvent("keydown", { key: "Enter" });
            if (previousEditing) previousEditing.dispatchEvent(pressEnter);
            propNode.classList.add("editing");
            const property = propNode.dataset.property; // need to reset this
            const originalValue = this[property];
            const inputUnfocused = (cancel) => {
              this[property] = cancel ? originalValue : event.target.value;
              event.target.remove();
              propNode.classList.remove("editing");
              log("Editing " + this.index + " " + property +  " finished, changes " +
                (cancel ? "discarded." : "saved."), "info");
            };
            const inputEdit = n("input|value=" + originalValue, "", {
              input: function (event) {
                this[property] = event.target.value;
              }.bind(this),
              keydown: function (event) {
                switch (event.key) {
                  case "Tab":
                    event.preventDefault();
                    const editables = this.root.view.querySelectorAll(".editable:not(.invisible)");
                    const thisIndex = Array.from(editables).indexOf(propNode);
                    const nextIndex = (editables.length - 1) !== thisIndex ?
                                      thisIndex + 1 : 0;
                    inputUnfocused();
                    editables[nextIndex].click(); // simulating a click is the easiest at this point and it does the job
                    break;
                  case "Enter":
                    event.preventDefault();
                    inputUnfocused();
                    break;
                  case "Escape":
                    event.preventDefault();
                    inputUnfocused(true);
                    break;
                  default:
                }
              }.bind(this)
            });
            propNode.appendChild(inputEdit);
            inputEdit.focus();
            log("Editing " + this.index + " " + property);
          }
        }.bind(this));
      }
    }

    this.view = n("li.line", [
      viewProps,
      this.viewChildren
    ]);
  }

  /* --- Setters --- */

  set modified (date) {
    this._modified = date;
  }

  set start (date) {
    this._start = date;
  }

  set end (date) {
    this._end = date;
  }

  set title (title) {
    if (title && title.trim() && title !== this.title) this._title = title;
    this.viewUpdate(false, [ "title" ]);
  }

  set unitNumber (unitNumber) {
    this._unitNumber = unitNumber;
    this.viewUpdate(false, [ "unitNumber", "cost" ]);
    this.viewUpdate("up", [ "total" ]);
  }

  set unitType (unitType) {
    this._unitType = unitType;
    if (unitType == "ls" || unitType == "lumpsum") this.unitNumber = 1;
    this.viewUpdate(false, [ "unitType" ]);
  }

  set unitCost (unitCost) {
    this._unitCost = unitCost;
    this.viewUpdate(false, [ "unitCost", "cost" ]);
    this.viewUpdate("up", [ "total" ]);
  }

  set frequency (frequency) {
    this._frequency = frequency;
    this.viewUpdate(false, [ "frequency" ]);
    this.viewUpdate("up", [ "total" ]);
  }

  set currency (currency) {
    this._currency = currency;
    this.viewUpdate(false, [ "currency" ]);
    this.viewUpdate("up", [ "total" ]);
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
    let title = this._title || this.levelName + "-" + this.lineNumber;
    return title.trim();
  }

  get unitNumber () {
    return this._unitNumber;
  }

  get unitType () {
    return this._unitType;
  }

  get unitCost () {
    return this._unitCost;
  }

  get frequency () {
    return this._frequency;
  }

  get currency () {
    let currency = this._currency || config.default.currency;
    return currency.substring(0,3).toUpperCase();
  }

  get cost () {
    return this.unitNumber * this.unitCost;
  }

  get total () {
    let total = 0;
    if (this.children && this.children.length) {
      for (var i = 0; i < this.children.length; i++) {
        let base = this.children[i].currency;
        if (this.currency !== base) {
          total += convert(this.children[i].total, base, this.currency);
        } else total += this.children[i].total;
      }
    } else total = this.cost ? this.cost * this.frequency : 0;
    return total;
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

  get ancestors () {
    let ancestors = [];
    let current = this;
    while (current.parent) {
      ancestors.push(current.parent);
      current = current.parent;
    }
    return ancestors;
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

  /* --- View --- */

  viewAdd (newLine, index) {
    this.viewChildren.appendChild(newLine.view);
    newLine.viewUpdate();
    newLine.parent.viewUpdate("up");
  }

  viewRemove () {
    this.view.remove();
    this.parent.viewUpdate("updown");
  }

  viewUpdate (recursion, properties) {
    switch (recursion) {
      case "down": // downward recursion (all children and all their descendats...)
        this.viewUpdate(false, properties);
        if (this.children) {
          for (let i = 0; i < this.children.length; i++) {
            this.children[i].viewUpdate("down", properties);
          }
        }
        break;
      case "up": // upward recursion (parent and all of its ancestors)
        this.viewUpdate(false, properties);
        if (this.parent) this.parent.viewUpdate("up")
        break;
      case "updown":
        this.viewUpdate("down", properties);
        this.viewUpdate("up", properties);
        break;
      case "side":
        this.viewUpdate(false, properties);
        console.log(this.siblings)
        for (var i = 0; i < this.siblings.length; i++) {
          this.siblings[i].viewUpdate("down", properties);
        }
      default: // if no recursive option specified or it's "false"
        if (properties) {
          for (let i = 0; i < properties.length; i++) {
            const property = properties[i];
            if (this.viewProps[property]) {
              let newValue = (
                property == "unitCost" ||
                property == "cost" ||
                property == "total"
              ) ? formatN(this[property]) : this[property];
              this.viewProps[property].querySelector("span").textContent = newValue;
              if (
                property == "unitCost" ||
                property == "unitNumber" ||
                property == "frequency"
              ) {
                this.viewUpdate(false, ["cost", "total"]);
              }
            }
          }
        } else {
          for (let property in this.viewProps) {
            if (property !== "tools" && this.viewProps.hasOwnProperty(property)) {
              let newValue = (
                property == "unitCost" ||
                property == "cost" ||
                property == "total"
              ) ? formatN(this[property]) : this[property];
              this.viewProps[property].querySelector("span").textContent = newValue;
              //console.log(property + " - " + newValue);
            }
          }
        }
        this.viewUpdateGrandTotal();
        //exportJSON(budget, "exportoutput"); // for debugging
        break;
    }

    // Hide some things for the fields that have no children (leafs) because these get zeroed anyway
    const leafFields = [
      this.viewProps.unitNumber,
      this.viewProps.unitType,
      this.viewProps.unitCost,
      this.viewProps.frequency,
      this.viewProps.cost
    ];
    for (let i = 0; i < leafFields.length; i++) {
      if (this.children && this.children.length) leafFields[i].classList.add("invisible");
      else leafFields[i].classList.remove("invisible");
    }
  }

  viewUpdateGrandTotal () {
    if (this.root.viewGrandTotal) {
      const grandTotal = this.root.viewGrandTotal.querySelector(".amount");
      const currency = this.root.viewGrandTotal.querySelector(".currency");
      grandTotal.textContent = formatN(this.root.total);
      currency.textContent = this.root.currency;
    }
  }

  appendToBody () {
    if (!this.root.appendedToBody) {
      const header = n("header", [
        n("span.col1", "Index"),
        n("span.col2", "Title"),
        n("span.col3", "Unit Number"),
        n("span.col4", "Unit Type"),
        n("span.col5", "Unit Cost"),
        n("span.col6", "Frequency"),
        n("span.col7", "Cost"),
        n("span.col8", "Total"),
        n("span.col9", "Currency")
      ]);
      this.root.viewGrandTotal = n("footer.grandtotal", [
        n("strong.title.alignright", "Grand Total"),
        n("strong.amount.alignright", this.root.total),
        n("strong.currency", this.root.currency)
      ]);
      document.body.appendChild(n("div.budget", [
        header,
        n("ul.root", this.root.view),
        this.root.viewGrandTotal
      ]))

      // The below event is necessary for the editing inputs to stay open if a user changes windows, but close them if they click elsewhere on the page
      document.addEventListener("click", function (event) {
        const inputsEditing = this.root.view.querySelectorAll(".editing input");
        const pressEnter = new KeyboardEvent("keydown", { key: "Enter" });
        for (var i = 0; i < inputsEditing.length; i++) {
          inputsEditing[i].dispatchEvent(pressEnter);
        }
      }.bind(this));
      this.root.view.addEventListener("click", function (event) {
        event.stopPropagation();
      }, false);

      this.root.appendedToBody = true;
    } else log("The root of this budget has already been added to the page.", "error");
  }


  /* --- Methods --- */

  add (options = {}, index) {

    let newParent = this;

    // let the child inherit the parent's cost data if any
    options.unitNumber = options.unitNumber || newParent.unitNumber || 1;
    options.unitType = options.unitType || newParent.unitType || "ls";
    options.unitCost = options.unitCost || newParent.unitCost || 0;
    options.frequency = options.frequency || newParent.frequency || 1;
    options.currency = options.currency || newParent.currency || this.root.currency;

    // a parent doesn't need these:
    this.unitNumber = 0;
    this.unitType = "";
    this.unitCost = 0;
    this.frequency = 0;

    if (index) {
      if (typeof index === "string") {
        let map = index.split(".");
        index = Number(map.pop());
        newParent = this.getLine(map.join("."));
      }
    }

    const newLine = new Line(options);

    Object.defineProperty(newLine, "parent", { get: () => newParent });
    if (newParent.children) {
      if (index && index < newParent.children.length) {
        newParent.children.splice(index - 1, 0, newLine);
      } else this.children.push(newLine);
    } else newParent.children = [newLine];

    newParent.viewAdd(newLine);
    if (!quietMode) log("New line added at " + newLine.index);
  }

  addLine (newLine, index) {
    if (newLine instanceof Line) {
      let newParent = this;
      Object.defineProperty(newLine, "parent", { get: () => newParent });
      if (newParent.children) {
        if (index && index < this.children.length) {
          newParent.children.splice(index - 1, 0, newLine);
        } else this.children.push(newLine);
      } else newParent.children = [newLine];
      newParent.viewAdd(newLine, index);
    } else log(newLine.toString() + " is not a Line object", "error");
  }

  remove (quietMode) {
    let index = this.index;
    let lineNumber = this.lineNumber;
    this.parent.children.splice(lineNumber - 1, 1);
    this.viewRemove();
    if (!quietMode) {
      log('Line ' + index + ' deleted', 'info');
    }
  }

  move (newIndex, addAsChild) {
    const oldIndex = this.index;
    const indexMap = addAsChild ? [] : newIndex.toString().split('.');
    const parentIndex = addAsChild ? newIndex : indexMap.slice(0, -1).join('.');
    const newParent = this.root.getLine(parentIndex);
    if (newParent) {
      newParent.addLine(cloneLine(JSON.stringify(this)));
      this.remove();
      newParent.viewUpdate("down");
      log('Line ' + oldIndex + ' moved to line ' + newIndex, 'info');
    } else log("There is no line at the index" + parentIndex, "error");
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
    this.viewUpdate("up", Object.keys(options));
  }

}

loadRates();

start();

const b = budget;
