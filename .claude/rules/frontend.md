# Frontend Conventions

## DOM Creation

Always use the `n()` helper from `dom.js`:

```javascript
import { n } from './dom.js';

// Element with classes, attributes, and event handlers
n('div.class1.class2|data-id=123', 'text content', { click: handler })

// Nested elements
n('ul.list', [
  n('li', 'Item 1'),
  n('li', 'Item 2')
])
```

Never use `innerHTML` or template strings for UI.

## Styling

1. All styles in `src/app.scss`
2. Use SCSS variables for colours: `$text-color`, `$accent-green`, etc.
3. Level colours come from `config.default.lineColours` (applied via JS)
4. Column widths use CSS custom properties: `--col-qty`, `--col-total`, etc.

## State Updates

Property setters trigger view updates:

```javascript
set title(value) {
  this._title = value;
  this.modified = Date.now();
  this.viewUpdate(false, ['title']);  // Update just this property
}
```

For recursive updates use: `'up'`, `'down'`, `'updown'`

## Number Formatting

Use `formatN()` from `dom.js` for displaying numbers. It respects `config.showDecimals`.
