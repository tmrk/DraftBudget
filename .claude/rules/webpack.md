# Webpack Rules

## Config Structure

- `webpack.common.js` — shared settings (entry, output, plugins)
- `webpack.dev.js` — merges common + style-loader + devServer
- `webpack.prod.js` — merges common + MiniCssExtractPlugin + Terser

## Important Settings

1. **Entry**: `./src/index.js`
2. **Output**: `dist/main.js` and `dist/main.css`
3. **Terser mangle: false** — preserves function names for console API
4. **Font handling**: woff2 files copied to `dist/fonts/`

## When Editing Configs

- Changes to common affect both dev and prod
- Test with `npm run build` after config changes
- SCSS rules are in dev/prod only (not common) to avoid duplication
