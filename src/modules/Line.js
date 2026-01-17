'use strict';

import { config } from './config.js';
import { log, getQuietMode } from './log.js';
import { n, formatN } from './dom.js';
import { convert, symbols } from './fx.js';
import { exportToJSON, cloneLine } from './serialize.js';
import { scheduleSave } from './persistence.js';
import { exportToExcel } from './excel.js';

/**
 * Format a decimal as a percentage string (e.g., 0.20 -> "20%")
 */
function formatPercent(value) {
  const percent = (parseFloat(value) || 0) * 100;
  return percent.toFixed(0) + '%';
}

/**
 * Overhead class - represents a percentage-based cost addition to a budget line
 * Supports currency conversion and compound calculations when multiple overheads exist
 */
export class Overhead {
  constructor(options = {}) {
    this._title = options.title || 'Overhead';
    this._percentage = parseFloat(options.percentage) || 0;
    this._currency = options.currency || null; // null = inherit from mainLine
    this._mainLine = null; // Set when added to a line
    this.view = null; // Will be created when needed
  }

  // === Getters ===

  get mainLine() { return this._mainLine; }

  get baseCurrency() {
    return this._mainLine?.currency;
  }

  get currency() {
    return this._currency || this.baseCurrency;
  }

  get level() {
    return this._mainLine?.level;
  }

  get title() {
    return this._title;
  }

  get percentage() {
    return this._percentage;
  }

  get index() {
    if (!this._mainLine) return null;
    const pos = this._mainLine.overhead.indexOf(this) + 1;
    return `OH${pos}-${this._mainLine.index}`;
  }

  /**
   * The base amount for calculating this overhead
   * Formula: mainLine's totalWithoutOverhead + sum of all previous overhead totals
   * This enables compound calculations where each overhead builds on top of all previous ones
   */
  get baseTotal() {
    if (!this._mainLine) return 0;

    const overheadArray = this._mainLine.overhead;
    const myIndex = overheadArray.indexOf(this);
    const lineCurrency = this.baseCurrency;

    // Start with the main line's total (without any overheads)
    let base = this._mainLine.totalWithoutOverhead;

    // Add all previous overhead totals (converted to this line's currency if needed)
    for (let i = 0; i < myIndex; i++) {
      const prevOh = overheadArray[i];
      if (prevOh.currency !== lineCurrency) {
        base += convert(prevOh.total, prevOh.currency, lineCurrency);
      } else {
        base += prevOh.total;
      }
    }

    return base;
  }

  /**
   * The calculated overhead amount, converted to this overhead's currency if needed
   */
  get total() {
    const amount = this.baseTotal * this._percentage;
    if (this.baseCurrency === this.currency) {
      return parseFloat(amount.toFixed(config.roundDecimals)) || 0;
    }
    const converted = convert(amount, this.baseCurrency, this.currency);
    return parseFloat(converted.toFixed(config.roundDecimals)) || 0;
  }

  // === Setters ===

  set title(value) {
    this._title = value;
    if (this._mainLine) {
      this._mainLine.modified = new Date().getTime();
    }
    this.viewUpdate(['title']);
  }

  set percentage(value) {
    this._percentage = parseFloat(value) || 0;
    if (this._mainLine) {
      this._mainLine.modified = new Date().getTime();
      this._mainLine.viewUpdate('up', ['total']);
    }
    this.viewUpdate(['percentage', 'total']);
  }

  set currency(value) {
    if (symbols.hasOwnProperty(value?.toUpperCase())) {
      this._currency = value.toUpperCase();
      if (this._mainLine) {
        this._mainLine.modified = new Date().getTime();
        this._mainLine.viewUpdate('up', ['total']);
      }
      this.viewUpdate(['currency', 'total']);
    }
  }

  // === View Methods ===

  /**
   * Create the DOM view for this overhead
   */
  createView() {
    const self = this;

    // Delete button
    const deleteIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    deleteIcon.setAttribute('viewBox', '0 0 24 24');
    deleteIcon.innerHTML = '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>';

    const buttonDelete = n('span.button.delete|title=Delete this overhead', '', {
      click: function(e) {
        e.stopPropagation();
        self._mainLine.removeOverhead(self);
      }
    });
    buttonDelete.appendChild(deleteIcon);

    // Move up button
    const upIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    upIcon.setAttribute('viewBox', '0 0 24 24');
    upIcon.innerHTML = '<path d="M7 14l5-5 5 5H7z"/>';

    const buttonUp = n('span.button.move-up|title=Move up (calculate earlier)', '', {
      click: function(e) {
        e.stopPropagation();
        self._mainLine.moveOverheadUp(self);
      }
    });
    buttonUp.appendChild(upIcon);

    // Move down button
    const downIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    downIcon.setAttribute('viewBox', '0 0 24 24');
    downIcon.innerHTML = '<path d="M7 10l5 5 5-5H7z"/>';

    const buttonDown = n('span.button.move-down|title=Move down (calculate later)', '', {
      click: function(e) {
        e.stopPropagation();
        self._mainLine.moveOverheadDown(self);
      }
    });
    buttonDown.appendChild(downIcon);

    this.view = {
      buttonDelete: buttonDelete,
      buttonUp: buttonUp,
      buttonDown: buttonDown,
      props: {
        index: n('div.col1.index.overhead-index', n('span', this.index)),
        title: n('div.col2.title.editable|title=Overhead title', n('span', this._title)),
        unitNumber: n('div.col3.invisible', n('span', '')),
        unitType: n('div.col4.invisible', n('span', '')),
        percentage: n('div.col5.percentage.alignright.editable|title=Percentage', n('span', formatPercent(this._percentage))),
        unitCurrency: n('div.col6.invisible', n('span', '')),
        cost: n('div.col7.invisible', n('span', '')),
        frequency: n('div.col8.invisible', n('span', '')),
        total: n('div.col9.total.alignright|title=Overhead total', n('span', formatN(this.total))),
        currency: n('div.col10.currency.editable|title=Currency', n('span', this.currency)),
        tools: n('div.col11.tools')
      },
      node: null
    };

    this.view.props.tools.append(buttonUp, buttonDown, buttonDelete);

    this.view.node = n('li.line.overhead', n('div.props', [
      this.view.props.index,
      this.view.props.title,
      this.view.props.unitNumber,
      this.view.props.unitType,
      this.view.props.percentage,
      this.view.props.unitCurrency,
      this.view.props.cost,
      this.view.props.frequency,
      this.view.props.total,
      this.view.props.currency,
      this.view.props.tools
    ]));

    // Add level class for styling
    this.view.node.classList.add('level' + this.level);
    this.view.node.dataset.level = this.level;

    // Set up click handlers for editable fields
    this.setupEditHandlers();

    // Apply background color
    this.applyLevelColor();
  }

  /**
   * Set up click handlers for editable fields
   */
  setupEditHandlers() {
    const self = this;

    // Title editing
    this.view.props.title.addEventListener('click', function(e) {
      e.stopPropagation();
      self.viewEdit('title');
    });

    // Percentage editing
    this.view.props.percentage.addEventListener('click', function(e) {
      e.stopPropagation();
      self.viewEdit('percentage');
    });

    // Currency editing
    this.view.props.currency.addEventListener('click', function(e) {
      e.stopPropagation();
      self.viewEdit('currency');
    });
  }

  /**
   * Edit a field inline
   */
  viewEdit(property) {
    const propNode = this.view.props[property];
    const propNodeInput = propNode.querySelector('input');
    if (propNodeInput) {
      propNodeInput.focus();
      return;
    }

    // Close any other editing input
    const previousEditing = this._mainLine.root.view.node.parentElement.querySelector('.editing input');
    if (previousEditing) {
      previousEditing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }

    propNode.classList.add('editing');

    // Get the actual value (not formatted)
    let originalValue;
    if (property === 'percentage') {
      originalValue = (this._percentage * 100).toString(); // Show as percentage number
    } else if (property === 'title') {
      originalValue = this._title;
    } else if (property === 'currency') {
      originalValue = this.currency;
    }

    const self = this;

    const removeInput = (saveEdit) => {
      document.removeEventListener('click', removeInput);
      const newValue = saveEdit ? inputEdit.value : originalValue;

      if (newValue !== originalValue) {
        if (property === 'percentage') {
          self.percentage = parseFloat(newValue) / 100; // Convert from % to decimal
        } else if (property === 'title') {
          self.title = newValue;
        } else if (property === 'currency') {
          self.currency = newValue;
        }
      }

      inputEdit.remove();
      propNode.classList.remove('editing');
    };

    document.addEventListener('click', removeInput);

    const inputEdit = n('input|value=' + originalValue, '', {
      input: function(event) {
        // Live preview (optional)
      },
      keydown: function(event) {
        switch (event.key) {
          case 'Enter':
            event.preventDefault();
            removeInput(true);
            break;
          case 'Escape':
            event.preventDefault();
            removeInput(false);
            break;
          case 'Tab':
            event.preventDefault();
            removeInput(true);
            // Move to next editable field
            const editables = ['title', 'percentage', 'currency'];
            const currentIdx = editables.indexOf(property);
            const nextIdx = (currentIdx + 1) % editables.length;
            self.viewEdit(editables[nextIdx]);
            break;
        }
      }
    });

    propNode.appendChild(inputEdit);
    inputEdit.focus();
    inputEdit.select();
  }

  /**
   * Apply level-based background color
   */
  applyLevelColor() {
    if (!this.view || !this._mainLine) return;

    const levelColor = config.default.lineColours[this.level] ||
                       config.default.lineColours[config.default.lineColours.length - 1];

    for (let prop in this.view.props) {
      if (this.view.props.hasOwnProperty(prop) && this.view.props[prop]?.style) {
        this.view.props[prop].style.backgroundColor = levelColor;
      }
    }

    // Also apply to tool buttons
    if (this.view.buttonDelete) this.view.buttonDelete.style.backgroundColor = levelColor;
    if (this.view.buttonUp) this.view.buttonUp.style.backgroundColor = levelColor;
    if (this.view.buttonDown) this.view.buttonDown.style.backgroundColor = levelColor;
  }

  /**
   * Update specific view properties
   */
  viewUpdate(properties) {
    if (!this.view) return;

    if (!properties) {
      properties = ['index', 'title', 'percentage', 'total', 'currency'];
    }

    for (const property of properties) {
      if (this.view.props[property]) {
        let newValue;
        switch (property) {
          case 'index':
            newValue = this.index;
            break;
          case 'title':
            newValue = this._title;
            break;
          case 'percentage':
            newValue = formatPercent(this._percentage);
            break;
          case 'total':
            newValue = formatN(this.total);
            break;
          case 'currency':
            newValue = this.currency;
            break;
        }
        if (newValue !== undefined) {
          this.view.props[property].querySelector('span').textContent = newValue;
        }
      }
    }

    // Update main line's grand total
    if (this._mainLine) {
      this._mainLine.viewUpdateGrandTotal();
    }
  }

  /**
   * Remove this overhead's view from DOM
   */
  viewRemove() {
    if (this.view?.node) {
      this.view.node.remove();
      this.view = null;
    }
  }
}

export class Line {

  // Maximum allowed level (levelNames.length - 1, since first is Budget)
  static get maxLevel() {
    return config.levelNames.length - 1;
  }

  // Column resize configuration: column class -> { cssVar, min (in ch) }
  static columnConfig = {
    col3:  { cssVar: '--col-qty',   min: 2 },  // unitNumber
    col4:  { cssVar: '--col-type',  min: 3 },  // unitType
    col5:  { cssVar: '--col-rate',  min: 7 },  // unitCost
    col6:  { cssVar: '--col-ucurr', min: 3 },  // unitCurrency
    // col7 is hidden (cost)
    col8:  { cssVar: '--col-freq',  min: 2 },  // frequency
    col9:  { cssVar: '--col-total', min: 7 },  // total
    col10: { cssVar: '--col-curr',  min: 3 },  // currency
  };

  // Debounce timer for column resize
  static resizeTimer = null;

  /**
   * Auto-resize columns based on their content
   * Uses character count for monospace font accuracy
   */
  static resizeColumns() {
    // Debounce to avoid excessive recalculations
    if (Line.resizeTimer) clearTimeout(Line.resizeTimer);
    Line.resizeTimer = setTimeout(() => {
      const budget = document.querySelector('.budget');
      if (!budget) return;

      for (const [colClass, colConfig] of Object.entries(Line.columnConfig)) {
        // Find all cells in this column (including header)
        const cells = budget.querySelectorAll(`.${colClass} > span`);
        let maxChars = 0;

        cells.forEach(span => {
          // For monospace font, character count = width in ch
          const charCount = span.textContent.length;
          if (charCount > maxChars) maxChars = charCount;
        });

        // Add 2ch for padding (1ch - 1px on each side ≈ 2ch)
        let widthInCh = maxChars + 2;

        // Apply minimum
        widthInCh = Math.max(widthInCh, colConfig.min);

        // Set CSS custom property
        budget.style.setProperty(colConfig.cssVar, `${widthInCh}ch`);
      }
    }, 50);
  }

  constructor (options = {}, level = 0) {

    // Check if this level can have children
    const canAddChildren = level < Line.maxLevel;
    const nextLevelName = canAddChildren ? config.levelNames[level + 1] : null;

    // The view needs to be initialised before looping through the options
    // Create delete button with inline SVG
    const deleteIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    deleteIcon.setAttribute('viewBox', '0 0 24 24');
    deleteIcon.innerHTML = '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>';

    const buttonDelete = n('span.button.delete|title=Delete this row', '',
      {click: function () {
          this.remove();
        }.bind(this)
      }
    );
    buttonDelete.appendChild(deleteIcon);

    // Create add button with inline SVG
    const addIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    addIcon.setAttribute('viewBox', '0 0 24 24');
    addIcon.innerHTML = '<path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>';

    const buttonAdd = n('span.button.add', '',
      {click: function (e) {
          e.stopImmediatePropagation();
          if (!this.canAddChildren()) {
            return; // Disabled state - do nothing
          }
          this.add();
          const newLine = this.children[this.children.length - 1];
          newLine.viewEdit('title');
        }.bind(this)
      }
    );
    buttonAdd.appendChild(addIcon);

    this.view = {
      buttonDelete: buttonDelete,
      buttonAdd: buttonAdd,
      props: {
        index: n('div.col1.index', n('span', this.index)),
        title: n('div.col2.title.editable|title=Title', n('span', this.title)),
        unitNumber: n('div.col3.unitnumber.editable|title=Unit quantity', n('span', this.unitNumber)),
        unitType: n('div.col4.unittype.editable|title=Unit type', n('span', this.unitType)),
        unitCost: n('div.col5.unitcost.alignright.editable|title=Unit cost', n('span', formatN(this.unitCost))),
        unitCurrency: n('div.col6.unitcurrency.editable|title=Unit currency', n('span', this.unitCurrency)),
        cost: n('div.col7.cost.alignright|title=Full cost', n('span', formatN(this.cost))),
        frequency: n('div.col8.frequency.editable|title=Frequency', n('span', this.frequency)),
        total: n('div.col9.total.alignright|title=Line total', n('span', formatN(this.total))),
        currency: n('div.col10.currency.editable|title=Currency', n('span', this.currency)),
        tools: n('div.col11.tools')
      },
      children: n('ul.children'),
      overhead: n('ul.overhead')
    };
    this.view.props.tools.append(this.view.buttonDelete, this.view.buttonAdd);

    // Initialize numeric fields to 0 (not using setters to avoid triggering viewUpdate)
    this._unitNumber = 0;
    this._unitCost = 0;
    this._frequency = 1;

    for (let v in options) {
      if (options.hasOwnProperty(v) && v !== 'children') this[v] = options[v];
    }
    this.currency = this.currency || config.default.currency;
    if (!this._start) this.start = new Date().getTime();
    if (!this._end) this.end = this._start + 86400000;

    this.created = this.created || new Date().getTime();
    this.modified = this.modified || this.created;

    for (let property in this.view.props) {
      const propNode = this.view.props[property];
      propNode.setAttribute('data-property', property);
      if (propNode.classList.contains('editable')) {

        /* Clicking on line properties to edit them */
        propNode.addEventListener('click', function (e) {
          e.stopPropagation();
          const property = propNode.dataset.property; // need to re-set this
          // Don't allow editing leaf-only fields on parent lines (except title and currency)
          const leafOnlyFields = ['unitNumber', 'unitType', 'unitCost', 'unitCurrency', 'frequency'];
          if (this.children && this.children.length && leafOnlyFields.includes(property)) {
            return; // Don't edit leaf-only fields on parent lines
          }
          this.viewEdit(property);
        }.bind(this));
      } else if (property == 'total' || property == 'cost') {
        propNode.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!this.children || !this.children.length) this.viewEdit('unitCost');
        }.bind(this));
      }
    }

    this.view.node = n('li.line', [
      n('div.props', [
        this.view.props.index,
        this.view.props.title,
        this.view.props.unitNumber,
        this.view.props.unitType,
        this.view.props.unitCost,
        this.view.props.unitCurrency,
        this.view.props.cost,
        this.view.props.frequency,
        this.view.props.total,
        this.view.props.currency,
        this.view.props.tools
      ]),
      this.view.children,
      this.view.overhead
    ]);
  }

  /* --- Setters --- */

  set modified (date) {
    this._modified = date;
    // Auto-save to localStorage (debounced)
    scheduleSave();
  }

  set start (date) {
    this._start = date;
    this.modified = new Date().getTime();
  }

  set end (date) {
    this._end = date;
    this.modified = new Date().getTime();
  }

  set title (title) {
    if (title && title.trim() && title !== this.title) this._title = title;
    this.modified = new Date().getTime();
    this.viewUpdate(false, [ 'title' ]);
  }

  set unitNumber (unitNumber) {
    this._unitNumber = unitNumber;
    this.modified = new Date().getTime();
    this.viewUpdate(false, [ 'unitNumber', 'cost' ]);
    this.viewUpdate('up', [ 'total' ]);
  }

  set unitType (unitType) {
    this._unitType = unitType;
    if (unitType == 'ls' || unitType == 'lumpsum') this.unitNumber = 1;
    this.modified = new Date().getTime();
    this.viewUpdate(false, [ 'unitType' ]);
  }

  set unitCost (unitCost) {
    this._unitCost = unitCost;
    this.modified = new Date().getTime();
    this.viewUpdate(false, [ 'unitCost', 'cost' ]);
    this.viewUpdate('up', [ 'total' ]);
  }

  set frequency (frequency) {
    this._frequency = frequency;
    this.modified = new Date().getTime();
    this.viewUpdate(false, [ 'frequency' ]);
    this.viewUpdate('up', [ 'total' ]);
  }

  set currency (currency) {
    if (symbols.hasOwnProperty(currency.toUpperCase())) { // only set the currency if it exists
      this._currency = currency;
      this.modified = new Date().getTime();
    }
    this.viewUpdate(false, [ 'currency' ]);
    this.viewUpdate('up', [ 'total' ]);
  }

  set unitCurrency (currency) {
    if (symbols.hasOwnProperty(currency.toUpperCase())) { // only set if valid currency
      this._unitCurrency = currency;
      this.modified = new Date().getTime();
    }
    this.viewUpdate(false, [ 'unitCurrency', 'cost' ]);
    this.viewUpdate('up', [ 'total' ]);
  }

  set category (category) {
    if (Array.isArray(category)) this._category = category;
    else this._category = [category];
    this.modified = new Date().getTime();
  }

  /* --- Getters --- */

  get modified () {
    let lastModified = this.getLast('_modified', true) || this;
    return lastModified._modified;
  }

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

  get defaultTitle () {
    return this.levelName + '-' + this.lineNumber;
  }

  get title () {
    let title = this._title || this.defaultTitle;
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

  get unitCurrency () {
    // Default to line currency if not set
    let currency = this._unitCurrency || this._currency || config.default.currency;
    return currency.substring(0,3).toUpperCase();
  }

  get cost () {
    const raw = this.unitNumber * this.unitCost;
    return parseFloat(raw.toFixed(config.roundDecimals)) || 0;
  }

  get totalWithoutOverhead () {
    let total = 0;
    if (this.children && this.children.length) {
      for (var i = 0; i < this.children.length; i++) {
        let base = this.children[i].currency;
        if (this.currency !== base) {
          total += convert(this.children[i].total, base, this.currency);
        } else total += this.children[i].total;
      }
    } else {
      // cost is in unitCurrency, convert to line currency if different
      let costInLineCurrency = this.cost * (this.frequency || 1);
      if (this.unitCurrency !== this.currency) {
        costInLineCurrency = convert(costInLineCurrency, this.unitCurrency, this.currency);
      }
      total = parseFloat(costInLineCurrency.toFixed(config.roundDecimals)) || 0;
    }
    return total;
  }

  /**
   * Total including all overheads
   * For compound overheads, each overhead's amount is added (converted to line currency if needed)
   */
  get total() {
    let total = this.totalWithoutOverhead;

    if (this.overhead && this.overhead.length) {
      // Add each overhead's total (converted to this line's currency if needed)
      for (const oh of this.overhead) {
        if (oh.currency === this.currency) {
          total += oh.total;
        } else {
          total += convert(oh.total, oh.currency, this.currency);
        }
      }
    }

    return parseFloat(total.toFixed(config.roundDecimals)) || 0;
  }

  /**
   * Sum of all overhead amounts for this line (in line's currency)
   */
  get overheadTotal() {
    if (!this.overhead?.length) return 0;

    let total = 0;
    for (const oh of this.overhead) {
      if (oh.currency === this.currency) {
        total += oh.total;
      } else {
        total += convert(oh.total, oh.currency, this.currency);
      }
    }

    return parseFloat(total.toFixed(config.roundDecimals)) || 0;
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
    for (let i = 0; i < this.parent.children.length; i++) {
      if (this.parent.children[i] !== this) {
        siblings.push(this.parent.children[i]);
      }
    }
    return siblings;
  }

  get descendants () {
    let descendants = [];
    if (this.children) {
      for (let i = 0; i < this.children.length; i++) {
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

  /**
   * Check if this line can have children added to it
   * Returns false if at max level (levelNames.length - 1)
   */
  canAddChildren () {
    return this.level < Line.maxLevel;
  }

  /* --- View methods --- */

  viewAdd (newLine, index) {
    this.view.children.appendChild(newLine.view.node);
    newLine.view.node.dataset.level = this.level + 1;
    newLine.view.node.classList.add('level' + (this.level + 1));
    newLine.viewUpdate();
    newLine.parent.viewUpdate('up');
  }

  viewEdit (property) {
    const propNode = this.view.props[property];
    const propNodeInput = propNode.querySelector('input');
    if (!propNodeInput) {

      const previousEditing = this.root.view.node.querySelector('.editing input');
      const pressEnter = new KeyboardEvent('keydown', { key: 'Enter' });
      if (previousEditing) previousEditing.dispatchEvent(pressEnter);
      propNode.classList.add('editing');

      const originalValue = this[property];

      const removeInput = (saveEdit) => {
        document.removeEventListener('click', removeInput);
        // Only update property if value actually changed to avoid setter side effects
        const newValue = saveEdit ? inputEdit.value : originalValue;
        if (newValue !== originalValue) {
          this[property] = newValue;
        }
        inputEdit.remove();
        propNode.classList.remove('editing');
        log('Editing ' + this.index + ' ' + property +  ' finished, changes ' +
          (saveEdit ? 'saved.' : 'discarded.'), 'info');
      };
      document.addEventListener('click', removeInput);

      // Use actual value - show 0 as "0", only use empty string for undefined/null
      const inputValue = (originalValue !== undefined && originalValue !== null) ? originalValue : '';

      // Numeric-only fields
      const numericFields = ['unitNumber', 'unitCost', 'cost', 'frequency'];
      const isNumeric = numericFields.includes(property);

      const inputEdit = n('input|value=' + inputValue, '', {
        input: function (event) {
          this[property] = event.target.value;
        }.bind(this),
        paste: function (event) {
          // For numeric fields, filter pasted content
          if (isNumeric) {
            event.preventDefault();
            const pastedText = (event.clipboardData || window.clipboardData).getData('text');
            const numericOnly = pastedText.replace(/[^0-9.\-]/g, '');
            document.execCommand('insertText', false, numericOnly);
          }
        },
        keydown: function (event) {
          // For numeric fields, only allow numbers and control keys
          if (isNumeric) {
            const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                                 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                                 'Home', 'End', '.', '-'];
            const isNumber = /^[0-9]$/.test(event.key);
            const isAllowed = allowedKeys.includes(event.key);
            const isModifier = event.ctrlKey || event.metaKey; // Allow Ctrl+C, Ctrl+V, etc.

            if (!isNumber && !isAllowed && !isModifier) {
              event.preventDefault();
              return;
            }
          }

          switch (event.key) {
            case 'Tab':
              event.preventDefault();
              const editables = this.root.view.node.querySelectorAll('.editable:not(.invisible)');
              const thisIndex = Array.from(editables).indexOf(propNode);
              const nextIndex = (editables.length - 1) !== thisIndex ?
                                thisIndex + 1 : 0;
              removeInput(true);
              editables[nextIndex].click(); // simulating a click is the easiest at this point and it does the job
              break;
            case 'ArrowUp':
            case 'ArrowDown':
              event.preventDefault();
              const sameColumn = this.root.view.node.querySelectorAll('.editable:not(.invisible)[data-property=' + property + ']');
              const thisIndexCol = Array.from(sameColumn).indexOf(propNode);
              const prevIndexCol = (thisIndexCol !== 0) ? thisIndexCol - 1 :
                                   sameColumn.length - 1;
              const nextIndexCol = (sameColumn.length - 1) !== thisIndexCol ?
                                   thisIndexCol + 1 : 0;
              const indexToSelect = (event.key == 'ArrowUp') ? prevIndexCol : nextIndexCol;
              removeInput(true);
              sameColumn[indexToSelect].click();
              break;
            case 'Enter':
              event.preventDefault();
              removeInput(true);
              break;
            case 'Escape':
              event.preventDefault();
              removeInput(false);
              break;
            default:
          }
        }.bind(this)
      });
      propNode.appendChild(inputEdit);
      inputEdit.focus();
      inputEdit.select();
      log('Editing ' + this.index + ' ' + property);
    } else propNodeInput.focus();
  }

  viewRemove () {
    this.view.node.remove();
    this.parent.viewUpdate('updown');
  }

  viewUpdate (recursion, properties) {
    switch (recursion) {
      case 'down': // downward recursion (all children and all their descendants...)
        this.viewUpdate(false, properties);
        if (this.children) {
          for (let i = 0; i < this.children.length; i++) {
            this.children[i].viewUpdate('down', properties);
          }
        }
        break;
      case 'up': // upward recursion (parent and all of its ancestors)
        this.viewUpdate(false, properties);
        if (this.parent) this.parent.viewUpdate('up')
        break;
      case 'updown':
        this.viewUpdate('down', properties);
        this.viewUpdate('up', properties);
        break;
      case 'side':
        this.viewUpdate(false, properties);
        console.log(this.siblings)
        for (let i = 0; i < this.siblings.length; i++) {
          this.siblings[i].viewUpdate('down', properties);
        }
      default: // if no recursive option specified or it's 'false'
        if (properties) {
          for (let i = 0; i < properties.length; i++) {
            const property = properties[i];
            if (this.view.props[property]) {
              let newValue = (
                property == 'unitCost' ||
                property == 'cost' ||
                property == 'total'
              ) ? formatN(this[property]) : this[property]; // format these as numbers
              this.view.props[property].querySelector('span').textContent = newValue;
              if (
                property == 'unitCost' ||
                property == 'unitNumber' ||
                property == 'frequency'
              ) {
                this.viewUpdate(false, ['cost', 'total']);
              }
            }
          }
        } else {
          for (let property in this.view.props) {
            if (property !== 'tools' && this.view.props.hasOwnProperty(property)) {
              let newValue = (
                property == 'unitCost' ||
                property == 'cost' ||
                property == 'total'
              ) ? formatN(this[property]) : this[property];
              this.view.props[property].querySelector('span').textContent = newValue;
            }
          }
        }
        this.viewUpdateGrandTotal();
        break;
    }

    // Apply row background color from config to each cell
    const levelColor = config.default.lineColours[this.level] || config.default.lineColours[config.default.lineColours.length - 1];
    for (let prop in this.view.props) {
      if (this.view.props.hasOwnProperty(prop) && prop !== 'tools') {
        this.view.props[prop].style.backgroundColor = levelColor;
      }
    }
    // Also apply to tool buttons
    this.view.buttonDelete.style.backgroundColor = levelColor;
    this.view.buttonAdd.style.backgroundColor = levelColor;

    // Hide some things for the fields that have no children (leafs) because these get zeroed anyway
    const leafFields = [
      this.view.props.unitNumber,
      this.view.props.unitType,
      this.view.props.unitCost,
      this.view.props.unitCurrency,
      this.view.props.frequency,
      this.view.props.cost
    ];
    for (let i = 0; i < leafFields.length; i++) {
      if (this.children && this.children.length) leafFields[i].classList.add('invisible');
      else leafFields[i].classList.remove('invisible');
    }

    // Update add button state based on actual level
    const canAdd = this.canAddChildren();
    if (canAdd) {
      this.view.buttonAdd.classList.remove('disabled');
      this.view.buttonAdd.setAttribute('title', 'Add a new ' + config.levelNames[this.level + 1]);
    } else {
      this.view.buttonAdd.classList.add('disabled');
      this.view.buttonAdd.removeAttribute('title');
    }

    // Auto-resize columns based on content (debounced)
    Line.resizeColumns();
  }

  viewUpdateGrandTotal () {
    if (this.root.view.grandTotal) {
      const grandTotal = this.root.view.grandTotal.querySelector('.amount');
      const currency = this.root.view.grandTotal.querySelector('.currency');
      grandTotal.textContent = formatN(this.root.total);
      currency.textContent = this.root.currency;
    }
  }

  /**
   * Get the last descendant of this line (for overhead positioning)
   */
  getLastDescendant() {
    if (!this.children?.length) return this;
    return this.children[this.children.length - 1].getLastDescendant();
  }

  /**
   * Add an overhead's view to the DOM after the line's last descendant
   */
  viewAddOverhead(overhead) {
    overhead.createView();
    const lastDescendant = this.getLastDescendant();

    // If there are existing overheads, insert after the last one
    if (this.overhead.length > 1) {
      const prevOverhead = this.overhead[this.overhead.indexOf(overhead) - 1];
      if (prevOverhead?.view?.node) {
        prevOverhead.view.node.after(overhead.view.node);
        return;
      }
    }

    // Otherwise insert after last descendant
    lastDescendant.view.node.after(overhead.view.node);
  }

  /**
   * Reposition all overhead views (after move operations)
   */
  viewRepositionOverheads() {
    if (!this.overhead?.length) return;

    // Remove all overhead views from DOM
    for (const oh of this.overhead) {
      if (oh.view?.node) {
        oh.view.node.remove();
      }
    }

    // Re-add them in order
    const lastDescendant = this.getLastDescendant();
    let insertAfter = lastDescendant.view.node;

    for (const oh of this.overhead) {
      if (!oh.view) oh.createView();
      insertAfter.after(oh.view.node);
      insertAfter = oh.view.node;
      oh.viewUpdate(); // Update all values
    }
  }

  /**
   * Update all overhead views for this line
   */
  viewUpdateOverheads() {
    if (!this.overhead?.length) return;
    for (const oh of this.overhead) {
      if (oh.view) {
        oh.viewUpdate();
      }
    }
  }

  appendToBody () {
    if (!this.root.appendedToBody) {
      const header = n('header.line', n('.props', [
        n('.col1', n('span', '#')),
        n('.col2', n('span', 'Title')),
        n('.col3', n('span', 'Qty')),
        n('.col4', n('span', 'Type')),
        n('.col5', n('span', 'Rate')),
        n('.col6', n('span', 'U.Cur')),
        n('.col7', n('span', 'Cost')),
        n('.col8', n('span', 'Fr')),
        n('.col9', n('span', 'Total')),
        n('.col10', n('span', 'Cur')),
        n('.col11', n('span', ''))
      ]));
      this.root.view.grandTotal = n('footer.grandtotal', [
        n('strong.title.alignright', 'Grand Total'),
        n('strong.amount.alignright', this.root.total),
        n('strong.currency', this.root.currency)
      ]);
      document.body.appendChild(n('div.budget', [
        header,
        n('ul.root', this.root.view.node),
        this.root.view.grandTotal,
        n('button', 'Export to Excel', {
          click: async function () {
            try {
              log('Exporting to Excel...');
              const filename = await exportToExcel(this);
              log('Exported to ' + filename, 'info');
            } catch (e) {
              log('Excel export failed: ' + e.message, 'error');
              console.error(e);
            }
          }.bind(this)
        }),
        n('button', 'Export to JSON', {
          click: function () {
            let a = document.createElement('a');
            document.body.appendChild(a);
            a.style = 'display: none';
            let data = exportToJSON(this);
            let blob = new Blob([data], {type: 'text/plain;charset=utf-8'});
            let url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = this.title.split(' ').join('_') + '_' +
              new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0]
              + '.json';
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
          }.bind(this)
        })
      ]));
      this.root.appendedToBody = true;
      // Auto-resize columns based on content
      Line.resizeColumns();
    } else log('The root of this budget has already been added to the page.', 'error');
  }

  /* --- Methods --- */

  add (options = {}, index) {

    // Check if adding is allowed at this level
    if (!this.canAddChildren()) {
      log('Cannot add children to ' + this.levelName + ' (max level ' + Line.maxLevel + ' reached)', 'error');
      return null;
    }

    let newParent = this;

    // let the child inherit the parent's cost data if any
    options.unitNumber = options.unitNumber || newParent.unitNumber || 1;
    options.unitType = options.unitType || newParent.unitType || 'ls';
    options.unitCost = options.unitCost || newParent.unitCost || 0;
    options.frequency = options.frequency || newParent.frequency || 1;
    options.currency = options.currency || newParent.currency || this.root.currency;

    // a parent doesn't need these (not using the setter to avoid updating '.modified'):
    this._unitNumber = 0;
    this._unitType = '';
    this._unitCost = 0;
    this._frequency = 0;

    if (index) {
      if (typeof index === 'string') {
        let map = index.split('.');
        index = Number(map.pop());
        newParent = this.getLine(map.join('.'));
      }
    }

    const newLine = new Line(options, this.level + 1);
    Object.defineProperty(newLine, 'parent', { get: () => newParent, configurable: true });
    if (newParent.children) {
      if (index && index < newParent.children.length) {
        newParent.children.splice(index - 1, 0, newLine);
      } else this.children.push(newLine);
    } else newParent.children = [newLine];

    newParent.viewAdd(newLine);
    if (!getQuietMode()) log('New line added at ' + newLine.index);
  }

  addLine (newLine, index) {
    if (newLine instanceof Line) {
      let newParent = this;
      Object.defineProperty(newLine, 'parent', { get: () => newParent, configurable: true });
      if (newParent.children) {
        if (index && index < this.children.length) {
          newParent.children.splice(index - 1, 0, newLine);
        } else this.children.push(newLine);
      } else newParent.children = [newLine];
      newParent.viewAdd(newLine, index);
    } else log(newLine.toString() + ' is not a Line object', 'error');
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

  /**
   * Move this line to a new position in the budget
   * @param {string|Line} target - Target index string (e.g., "1.2") or Line object
   * @param {boolean|string} addAsChild - If true/'child': add as last child of target
   *                                      If false: move to the position indicated by target index
   *                                      If 'before': insert before target line
   *                                      If 'after': insert after target line
   * @returns {boolean} Success status
   */
  move (target, addAsChild = false) {
    const oldIndex = this.index;
    const oldParent = this.parent;

    // Can't move root
    if (this.level === 0) {
      log('Cannot move the root budget line', 'error');
      return false;
    }

    // Determine target line and new parent
    let targetLine, newParent, insertPosition;

    if (target instanceof Line) {
      targetLine = target;
    } else if (typeof target === 'string') {
      targetLine = this.root.getLine(target);
    } else {
      log('Invalid target: must be a Line object or index string', 'error');
      return false;
    }

    if (!targetLine) {
      log('Target line not found: ' + target, 'error');
      return false;
    }

    // Can't move to self
    if (targetLine === this) {
      log('Cannot move a line to itself', 'error');
      return false;
    }

    // Can't move to a descendant
    if (this.descendants.includes(targetLine)) {
      log('Cannot move a line to its own descendant', 'error');
      return false;
    }

    // Determine new parent and insert position based on addAsChild mode
    if (addAsChild === true || addAsChild === 'child') {
      // Add as last child of target
      newParent = targetLine;
      insertPosition = newParent.children ? newParent.children.length : 0;
    } else if (addAsChild === 'before') {
      // Insert before target (as sibling)
      newParent = targetLine.parent;
      insertPosition = targetLine.lineNumber - 1; // 0-based index
    } else if (addAsChild === 'after') {
      // Insert after target (as sibling)
      newParent = targetLine.parent;
      insertPosition = targetLine.lineNumber; // Insert after = at lineNumber (0-based)
    } else {
      // addAsChild is false: target index specifies the position
      // e.g., "2.1" means become the 1st child of line 2
      if (typeof target === 'string') {
        const indexMap = target.split('.');
        const positionInParent = parseInt(indexMap.pop()); // Last number is position (1-based)
        const parentIndex = indexMap.join('.');
        newParent = parentIndex ? this.root.getLine(parentIndex) : this.root;
        insertPosition = positionInParent - 1; // Convert to 0-based
      } else {
        // Target is a Line, treat as "after"
        newParent = targetLine.parent;
        insertPosition = targetLine.lineNumber;
      }
    }

    if (!newParent) {
      log('Could not determine new parent for move', 'error');
      return false;
    }

    // Check if new parent can have children (level constraint)
    if (!newParent.canAddChildren()) {
      log('Cannot move to ' + newParent.levelName + ' (max level reached)', 'error');
      return false;
    }

    // Check if this line (with its descendants) would exceed max level
    const maxDescendantDepth = this.getMaxDescendantDepth();
    const newLevel = newParent.level + 1;
    if (newLevel + maxDescendantDepth > Line.maxLevel) {
      log('Cannot move: descendants would exceed max level', 'error');
      return false;
    }

    // --- Perform the move ---

    // 1. Remove from old parent's children array
    const oldPosition = oldParent.children.indexOf(this);
    oldParent.children.splice(oldPosition, 1);

    // 2. Remove from DOM (temporarily)
    this.view.node.remove();

    // 3. Ensure new parent has children array
    if (!newParent.children) newParent.children = [];

    // 4. Adjust insert position if moving within same parent
    if (newParent === oldParent && insertPosition > oldPosition) {
      insertPosition--;
    }

    // 5. Clamp insert position to valid range
    insertPosition = Math.max(0, Math.min(insertPosition, newParent.children.length));

    // 6. Insert into new parent's children array
    newParent.children.splice(insertPosition, 0, this);

    // 7. Update parent reference
    const self = this;
    Object.defineProperty(this, 'parent', { get: () => newParent, configurable: true });

    // 8. Insert into DOM at correct position
    if (insertPosition < newParent.children.length - 1) {
      // Insert before the next sibling
      const nextSibling = newParent.children[insertPosition + 1];
      newParent.view.children.insertBefore(this.view.node, nextSibling.view.node);
    } else {
      // Append at end
      newParent.view.children.appendChild(this.view.node);
    }

    // 9. Refresh levels on moved line and all its descendants
    this.refreshLevels();

    // 10. Clear old parent's leaf data if it no longer has children
    if (oldParent.children.length === 0) {
      // Old parent is now a leaf - it may need its values restored
      // (but we don't track original values, so just leave as is)
    }

    // 11. Update views
    oldParent.viewUpdate('up');
    newParent.viewUpdate('down');
    this.viewUpdate('down');

    log('Line ' + oldIndex + ' moved to ' + this.index, 'info');
    return true;
  }

  /**
   * Get the maximum depth of descendants (for level validation)
   * @returns {number} Maximum levels below this line
   */
  getMaxDescendantDepth () {
    if (!this.children || this.children.length === 0) return 0;
    let maxDepth = 0;
    for (const child of this.children) {
      const childDepth = 1 + child.getMaxDescendantDepth();
      if (childDepth > maxDepth) maxDepth = childDepth;
    }
    return maxDepth;
  }

  // FIX: Added this. and callback parameter
  recurse (line, callback) {
    callback(line);
    if (line.children) for (var i = 0; i < line.children.length; i++) {
      this.recurse(line.children[i], callback);
    }
  }

  /**
   * Refresh level classes on all nodes in the tree
   * Call this after loading from localStorage to fix level assignments
   */
  refreshLevels () {
    this.recurse(this, (line) => {
      // Remove old level classes
      for (let i = 0; i < 10; i++) {
        line.view.node.classList.remove('level' + i);
      }
      // Add correct level class
      line.view.node.classList.add('level' + line.level);
      line.view.node.dataset.level = line.level;
      // Update index display
      line.viewUpdate(false, ['index']);
    });
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
    for (let i = 0; i < items.length; i++) {
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

  /**
   * Add an overhead to this line
   * @param {Object} options - { title, percentage, currency }
   * @returns {Overhead} The created overhead
   */
  addOverhead(options = {}) {
    const oh = new Overhead(options);
    oh._mainLine = this;

    if (!this.overhead) this.overhead = [];
    this.overhead.push(oh);

    this.viewAddOverhead(oh);
    this.viewUpdate('up', ['total']);

    if (!getQuietMode()) {
      log('Overhead added: ' + oh.index + ' (' + oh.title + ')');
    }

    return oh;
  }

  /**
   * Remove an overhead from this line
   * @param {Overhead|number} overhead - The overhead instance or its index (1-based)
   */
  removeOverhead(overhead) {
    if (typeof overhead === 'number') {
      // Handle legacy numeric index (1-based)
      overhead = this.overhead?.[overhead - 1];
    }

    if (!overhead || !(overhead instanceof Overhead)) {
      log('Invalid overhead reference', 'error');
      return;
    }

    const index = this.overhead.indexOf(overhead);
    if (index === -1) {
      log('Overhead not found on this line', 'error');
      return;
    }

    const ohIndex = overhead.index;
    this.overhead.splice(index, 1);
    overhead.viewRemove();
    overhead._mainLine = null;

    // Update remaining overhead indices
    this.viewUpdateOverheads();
    this.viewUpdate('up', ['total']);

    log('Overhead ' + ohIndex + ' deleted.', 'info');
  }

  /**
   * Move overhead up in the calculation order (earlier)
   * @param {Overhead} overhead - The overhead to move
   */
  moveOverheadUp(overhead) {
    const index = this.overhead.indexOf(overhead);
    if (index > 0) {
      [this.overhead[index - 1], this.overhead[index]] =
        [this.overhead[index], this.overhead[index - 1]];
      this.viewRepositionOverheads();
      this.viewUpdate('up', ['total']);
    }
  }

  /**
   * Move overhead down in the calculation order (later)
   * @param {Overhead} overhead - The overhead to move
   */
  moveOverheadDown(overhead) {
    const index = this.overhead.indexOf(overhead);
    if (index < this.overhead.length - 1) {
      [this.overhead[index], this.overhead[index + 1]] =
        [this.overhead[index + 1], this.overhead[index]];
      this.viewRepositionOverheads();
      this.viewUpdate('up', ['total']);
    }
  }

  /**
   * Move overhead to another line
   * @param {Overhead} overhead - The overhead to move
   * @param {Line} targetLine - The destination line
   */
  moveOverheadTo(overhead, targetLine) {
    if (!(overhead instanceof Overhead) || !(targetLine instanceof Line)) {
      log('Invalid overhead or target line', 'error');
      return;
    }

    const index = this.overhead.indexOf(overhead);
    if (index === -1) {
      log('Overhead not found on this line', 'error');
      return;
    }

    // Remove from this line
    this.overhead.splice(index, 1);
    overhead.viewRemove();

    // Add to target line
    overhead._mainLine = targetLine;
    if (!targetLine.overhead) targetLine.overhead = [];
    targetLine.overhead.push(overhead);

    targetLine.viewAddOverhead(overhead);
    this.viewUpdate('up', ['total']);
    targetLine.viewUpdate('up', ['total']);

    log('Overhead moved to line ' + targetLine.index, 'info');
  }

  /**
   * Update overhead properties (legacy API support)
   * @param {number} index - 1-based index
   * @param {string} title - New title
   * @param {number} percentage - New percentage (decimal)
   */
  updateOverhead(index, title, percentage) {
    const oh = this.overhead?.[index - 1];
    if (oh) {
      if (title !== undefined) oh.title = title;
      if (percentage !== undefined) oh.percentage = percentage;
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
    this.viewUpdate('up', Object.keys(options));
  }

}
