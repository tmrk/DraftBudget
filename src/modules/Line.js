'use strict';

import { config } from './config.js';
import { log, getQuietMode } from './log.js';
import { n, formatN } from './dom.js';
import { convert, symbols } from './fx.js';
import { exportToJSON, cloneLine } from './serialize.js';

export class Line {

  constructor (options = {}, level = 0) {

    // The view needs to be initialised before looping through the options
    this.view = {
      buttonDelete: n('span.button.delete', 'Delete',
        {click: function () {
            this.remove();
          }.bind(this)
        }
      ),
      buttonAdd: n('span.button.add', 'Add ' + config.levelNames[level + 1],
        {click: function (e) {
            e.stopImmediatePropagation(); // so that it doesn't fire removeInput() upon clicking on document
            this.add();
            const newLine = this.children[this.children.length - 1];
            newLine.viewEdit('title');
           }.bind(this)
        }
      ),
      props: {
        index: n('div.col1.index', n('span', this.index)),
        title: n('div.col2.title.editable', n('span', this.title)),
        unitNumber: n('div.col3.unitnumber.editable', n('span', this.unitNumber)),
        unitType: n('div.col4.unittype.editable', n('span', this.unitType)),
        unitCost: n('div.col5.unitcost.alignright.editable', n('span', formatN(this.unitCost))),
        frequency: n('div.col6.frequency.alignright.editable', n('span', this.frequency)),
        cost: n('div.col7.cost.alignright', n('span', formatN(this.cost))),
        total: n('div.col8.total.alignright', n('span', formatN(this.total))),
        currency: n('div.col9.currency.editable', n('span', this.currency)),
        tools: n('div.col10.tools')
      },
      children: n('ul.children'),
      overhead: n('ul.overhead')
    };
    this.view.props.tools.append(this.view.buttonDelete, this.view.buttonAdd);

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
        this.view.props.frequency,
        this.view.props.cost,
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

  get cost () {
    return this.unitNumber * this.unitCost;
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
    } else total = this.cost ? this.cost * this.frequency : 0;
    return total;
  }

  get total () {
    let total = this.totalWithoutOverhead;
    if (this.overhead && this.overhead.length) {
      for (let i = 0; i < this.overhead.length; i++) {
        total = total + this.overhead[i].cost;
      }
    }
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

  /* --- View methods --- */

  viewAdd (newLine, index) {
    this.view.children.appendChild(newLine.view.node);
    newLine.view.node.dataset.level = this.level + 1;
    newLine.view.node.classList.add('level' + (this.level + 1));
    if (this.level + 2 == config.levelNames.length) newLine.view.node.classList.add('hide-add-button');
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
        this[property] = saveEdit ? inputEdit.value : originalValue;
        inputEdit.remove();
        propNode.classList.remove('editing');
        log('Editing ' + this.index + ' ' + property +  ' finished, changes ' +
          (saveEdit ? 'saved.' : 'discarded.'), 'info');
      };
      document.addEventListener('click', removeInput);

      const inputEdit = n('input'
                      + '|value=' + originalValue
                      + '|placeholder=' + this.defaultTitle,
                      '', {
        input: function (event) {
          this[property] = event.target.value;
        }.bind(this),
        keydown: function (event) {
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
        //if (this.view.node) this.view.node.querySelector('.props').style.backgroundColor = config.default.lineColours[this.level]; // Row colours from config
        break;
    }

    // Hide some things for the fields that have no children (leafs) because these get zeroed anyway
    const leafFields = [
      this.view.props.unitNumber,
      this.view.props.unitType,
      this.view.props.unitCost,
      this.view.props.frequency,
      this.view.props.cost
    ];
    for (let i = 0; i < leafFields.length; i++) {
      if (this.children && this.children.length) leafFields[i].classList.add('invisible');
      else leafFields[i].classList.remove('invisible');
    }
  }

  viewUpdateGrandTotal () {
    if (this.root.view.grandTotal) {
      const grandTotal = this.root.view.grandTotal.querySelector('.amount');
      const currency = this.root.view.grandTotal.querySelector('.currency');
      grandTotal.textContent = formatN(this.root.total);
      currency.textContent = this.root.currency;
    }
  }

  viewAddOverhead (newOverhead) {
    this.view.overhead.classList.add('hasoverhead');
    const viewNewOverhead = n('li.overhead', [
      n('span', 'Overhead for ' + this.index),
      n('span.title', newOverhead.title),
      n('span.rate', newOverhead.rate),
      n('span.cost', formatN(newOverhead.cost)),
      n('span', this.currency)
    ]);
    this.view.overhead.appendChild(viewNewOverhead);
  }

  viewUpdateOverhead (index, properties) {
    if (this.overhead[index]) {
      if (properties) {
        for (let i = 0; i < properties.length; i++) {
          const property = properties[i];
          this.view.overhead.querySelector('.' + property).textContent = this.overhead[property];
        }
      } else this.viewUpdateOverhead(index, Object.keys(this.overhead[index]));
      this.viewUpdate('up', [ 'total' ]);
    }
  }

  appendToBody () {
    if (!this.root.appendedToBody) {
      const header = n('header.line', n('.props', [
        n('.col1', n('span', 'Index')),
        n('.col2', n('span', 'Title')),
        n('.col3', n('span', 'Unit Number')),
        n('.col4', n('span', 'Unit Type')),
        n('.col5', n('span', 'Unit Cost')),
        n('.col6', n('span', 'Frequency')),
        n('.col7', n('span', 'Cost')),
        n('.col8', n('span', 'Total')),
        n('.col9', n('span', 'Currency')),
        n('.col10', n('span', 'Tools'))
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
          click: function () {
            // exportToExcel(budget); // Commented out - ExcelJS not implemented
            log('Excel export not implemented', 'warn');
          }
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
    } else log('The root of this budget has already been added to the page.', 'error');
  }

  /* --- Methods --- */

  add (options = {}, index) {

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
    Object.defineProperty(newLine, 'parent', { get: () => newParent });
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
      Object.defineProperty(newLine, 'parent', { get: () => newParent });
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

  move (newIndex, addAsChild) {
    const clone = cloneLine(this);
    console.log(clone);
    /*
    const oldIndex = this.index;
    const indexMap = addAsChild ? [] : newIndex.toString().split('.');
    const parentIndex = addAsChild ? newIndex : indexMap.slice(0, -1).join('.');
    const newParent = this.root.getLine(parentIndex);
    if (newParent) {
      newParent.addLine(cloneLine(JSON.stringify(this)));
      this.remove();
      newParent.viewUpdate('down');
      log('Line ' + oldIndex + ' moved to line ' + newIndex, 'info');
    } else log('There is no line at the index' + parentIndex, 'error');
    */
  }

  // FIX: Added this. and callback parameter
  recurse (line, callback) {
    callback(line);
    if (line.children) for (var i = 0; i < line.children.length; i++) {
      this.recurse(line.children[i], callback);
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

  addOverhead (title, rate) {
    const newOverhead = {
      title: title,
      rate: rate
    };

    Object.defineProperty(newOverhead, 'cost', { get: function() {
      return this.totalWithoutOverhead * newOverhead.rate;
    }.bind(this)});

    if (this.overhead) this.overhead.push(newOverhead);
    else this.overhead = [newOverhead];

    this.viewAddOverhead(newOverhead);
  }

  removeOverhead (index) {
    if (this.overhead && this.overhead[index]) {
      this.overhead.splice(index - 1, 1);
      log('Overhead ' + index + ' from line ' + this.index + ' deleted.', 'info');
    } else log('Line ' + this.index + ' has no overhead at index ' + index, 'error');
    this.viewUpdate('up', [ 'total' ]);
  }

  updateOverhead (index, title, rate) {
    if (this.overhead && this.overhead[index]) {
      if (title) this.overhead[index].title = title;
      if (rate) this.overhead[index].rate = rate;
      //this.viewUpdate('up', [ 'total' ]);
      this.viewUpdateOverhead(index);
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
