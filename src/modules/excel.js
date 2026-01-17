'use strict';

import ExcelJS from 'exceljs';
import { config } from './config.js';
import { ratesByBase } from './fx.js';

/**
 * Export a budget line and all its descendants to Excel
 * Includes a Rates sheet for currency conversion formulas
 */
export async function exportToExcel(rootLine) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DraftBudget';
  workbook.created = new Date();

  // Collect all unique currency pairs used in the budget
  const currencyPairs = new Set();
  const baseCurrency = rootLine.currency || config.default.currency;

  function collectCurrencyPairs(line) {
    const lineCurrency = line.currency || baseCurrency;
    const unitCurrency = line.unitCurrency || lineCurrency;

    // Unit currency to line currency conversion
    if (unitCurrency !== lineCurrency) {
      currencyPairs.add(`${unitCurrency}_${lineCurrency}`);
    }

    // Child currency to parent currency conversion
    if (line.children) {
      for (const child of line.children) {
        const childCurrency = child.currency || baseCurrency;
        if (childCurrency !== lineCurrency) {
          currencyPairs.add(`${childCurrency}_${lineCurrency}`);
        }
        collectCurrencyPairs(child);
      }
    }
  }
  collectCurrencyPairs(rootLine);

  // ========== RATES SHEET ==========
  const ratesSheet = workbook.addWorksheet('Rates', {
    properties: { defaultRowHeight: 20 }
  });

  // Style constants
  const fontName = 'Arial';
  const fontSize = 11;
  const greenDark = '1B5E20';    // Dark green for headers
  const greenMedium = '4CAF50';  // Medium green
  const greenLight = 'C8E6C9';   // Light green for alternating rows
  const greenLighter = 'E8F5E9'; // Very light green
  const white = 'FFFFFF';
  const borderColor = 'A5D6A7';  // Light green border

  ratesSheet.columns = [
    { header: 'From', key: 'from', width: 12 },
    { header: 'To', key: 'to', width: 12 },
    { header: 'Rate', key: 'rate', width: 15 }
  ];

  // Style rates header
  const ratesHeaderRow = ratesSheet.getRow(1);
  ratesHeaderRow.height = 24;
  ratesHeaderRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: greenDark } };
    cell.font = { name: fontName, size: fontSize, bold: true, color: { argb: white } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: greenMedium } },
      bottom: { style: 'thin', color: { argb: greenMedium } },
      left: { style: 'thin', color: { argb: greenMedium } },
      right: { style: 'thin', color: { argb: greenMedium } }
    };
  });

  // Add currency pairs with rates
  const ratesMap = new Map(); // Maps "FROM_TO" to row number in Rates sheet
  let rateRowNum = 2;

  // Always add 1:1 rate for same currency
  currencyPairs.add(`${baseCurrency}_${baseCurrency}`);

  for (const pair of currencyPairs) {
    const [from, to] = pair.split('_');
    let rate = 1;

    if (from !== to) {
      // Try to get rate from cached rates
      if (ratesByBase[from]?.rates?.[to]) {
        rate = ratesByBase[from].rates[to];
      } else if (ratesByBase[to]?.rates?.[from]) {
        rate = 1 / ratesByBase[to].rates[from];
      }
    }

    const row = ratesSheet.addRow({ from, to, rate });
    row.height = 20;

    // Style alternating rows
    const bgColor = (rateRowNum % 2 === 0) ? greenLighter : white;
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.font = { name: fontName, size: fontSize };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: borderColor } },
        bottom: { style: 'thin', color: { argb: borderColor } },
        left: { style: 'thin', color: { argb: borderColor } },
        right: { style: 'thin', color: { argb: borderColor } }
      };
    });

    // Format rate with more decimals
    row.getCell('rate').numFmt = '0.000000';

    ratesMap.set(pair, rateRowNum);
    rateRowNum++;
  }

  // ========== BUDGET SHEET ==========
  const sheet = workbook.addWorksheet(rootLine.title || 'Budget', {
    properties: { defaultRowHeight: 22 },
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  // Level colors - green shading from light to darker
  const levelColors = [greenLight, greenLighter, white, white, white];

  // Define columns
  sheet.columns = [
    { header: '#', key: 'index', width: 10 },
    { header: 'Title', key: 'title', width: 40 },
    { header: 'Qty', key: 'qty', width: 8 },
    { header: 'Type', key: 'type', width: 8 },
    { header: 'Unit Cost', key: 'unitCost', width: 12 },
    { header: 'Unit Cur', key: 'unitCurrency', width: 9 },
    { header: 'Freq', key: 'freq', width: 6 },
    { header: 'Subtotal', key: 'subtotal', width: 14 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Currency', key: 'currency', width: 10 }
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: greenDark } };
    cell.font = { name: fontName, size: fontSize, bold: true, color: { argb: white } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: greenMedium } },
      bottom: { style: 'thin', color: { argb: greenMedium } },
      left: { style: 'thin', color: { argb: greenMedium } },
      right: { style: 'thin', color: { argb: greenMedium } }
    };
  });

  // Track row info for formulas
  const rowMap = new Map();

  // Collect all lines in order, including overheads
  function collectLines(line, parentIndex = null) {
    const lines = [];
    const isRoot = line.index === 0;
    lines.push({ line, parentIndex, isRoot, isOverhead: false });

    if (line.children?.length > 0) {
      for (const child of line.children) {
        lines.push(...collectLines(child, isRoot ? 'root' : line.index));
      }
    }

    // Add overheads after all descendants
    if (line.overhead?.length > 0) {
      for (const oh of line.overhead) {
        lines.push({
          line: null,
          overhead: oh,
          parentLine: line,
          parentIndex: isRoot ? 'root' : line.index,
          isRoot: false,
          isOverhead: true
        });
      }
    }

    return lines;
  }

  const allLines = collectLines(rootLine);

  // Helper to get rate lookup formula
  function getRateLookupFormula(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return '1';
    const pair = `${fromCurrency}_${toCurrency}`;
    const rateRow = ratesMap.get(pair);
    if (rateRow) {
      return `Rates!$C$${rateRow}`;
    }
    // Fallback: return 1 if rate not found
    return '1';
  }

  // First pass: add all rows
  let currentRow = 2;

  for (const entry of allLines) {
    if (entry.isOverhead) {
      // Overhead row
      const oh = entry.overhead;
      const parentLine = entry.parentLine;
      const level = parentLine.level || 0;
      const ohCurrency = oh.currency;

      const row = sheet.addRow({
        index: oh.index,
        title: oh.title,
        qty: '',
        type: '',
        unitCost: oh.percentage * 100, // Show as percentage number
        unitCurrency: '%',
        freq: '',
        subtotal: '',
        total: oh.total,
        currency: ohCurrency
      });
      row.height = 22;

      // Store overhead row info
      const ohKey = `overhead_${oh.index}`;
      rowMap.set(ohKey, {
        rowNum: currentRow,
        isOverhead: true,
        level: level,
        currency: ohCurrency,
        parentLineIndex: entry.parentIndex
      });

      currentRow++;
    } else {
      // Regular line
      const { line, parentIndex, isRoot } = entry;
      const hasChildren = line.children?.length > 0;
      const level = line.level || 0;
      const lineIndex = isRoot ? 'root' : line.index;
      const lineCurrency = line.currency || baseCurrency;
      const unitCurrency = line.unitCurrency || lineCurrency;

      const row = sheet.addRow({
        index: isRoot ? '' : line.index,
        title: line.title,
        qty: hasChildren ? '' : (line.unitNumber || 0),
        type: hasChildren ? '' : (line.unitType || ''),
        unitCost: hasChildren ? '' : (line.unitCost || 0),
        unitCurrency: hasChildren ? '' : unitCurrency,
        freq: hasChildren ? '' : (line.frequency || 1),
        subtotal: '',
        total: '',
        currency: lineCurrency
      });
      row.height = 22;

      rowMap.set(lineIndex, {
        rowNum: currentRow,
        childRows: [],
        overheadRows: [],
        hasChildren,
        level,
        currency: lineCurrency,
        unitCurrency: unitCurrency
      });

      if (parentIndex !== null && rowMap.has(parentIndex)) {
        rowMap.get(parentIndex).childRows.push({
          rowNum: currentRow,
          currency: lineCurrency
        });
      }

      currentRow++;
    }
  }

  // Second pass: apply formulas and styling
  currentRow = 2;

  for (const entry of allLines) {
    const row = sheet.getRow(currentRow);

    if (entry.isOverhead) {
      // Overhead row styling
      const oh = entry.overhead;
      const ohKey = `overhead_${oh.index}`;
      const info = rowMap.get(ohKey);
      const level = info.level;

      // Apply styling for overhead rows (slightly muted)
      const bgColor = levelColors[level] || levelColors[levelColors.length - 1];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: borderColor } },
          bottom: { style: 'thin', color: { argb: borderColor } },
          left: { style: 'thin', color: { argb: borderColor } },
          right: { style: 'thin', color: { argb: borderColor } }
        };
        cell.font = { name: fontName, size: fontSize, italic: true }; // Italic for overhead

        // Number formatting
        if (colNumber === 5) { // Percentage value
          cell.numFmt = '0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (colNumber === 9) { // Total
          cell.numFmt = '#,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if ([6, 10].includes(colNumber)) { // Unit (%), Currency
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
      });

      // Indent title to match level
      if (level > 0) {
        row.getCell('title').alignment = { vertical: 'middle', horizontal: 'left', indent: level };
      }
    } else {
      // Regular line
      const { line, isRoot } = entry;
      const lineIndex = isRoot ? 'root' : line.index;
      const info = rowMap.get(lineIndex);
      const hasChildren = info.hasChildren;
      const level = info.level;
      const lineCurrency = info.currency;
      const unitCurrency = info.unitCurrency;

      const subtotalCell = row.getCell('subtotal');
      const totalCell = row.getCell('total');

      if (hasChildren && info.childRows.length > 0) {
        // Parent row: sum children's totals with currency conversion
        const sumParts = info.childRows.map(child => {
          const rateFormula = getRateLookupFormula(child.currency, lineCurrency);
          return `I${child.rowNum}*${rateFormula}`;
        });
        totalCell.value = { formula: sumParts.join('+') };
        subtotalCell.value = '';
      } else {
        // Leaf row: Subtotal = Qty * UnitCost * Freq (in unit currency)
        // Total = Subtotal * conversion rate (to line currency)
        subtotalCell.value = { formula: `C${currentRow}*E${currentRow}*G${currentRow}` };

        const rateFormula = getRateLookupFormula(unitCurrency, lineCurrency);
        if (rateFormula === '1') {
          totalCell.value = { formula: `H${currentRow}` };
        } else {
          totalCell.value = { formula: `H${currentRow}*${rateFormula}` };
        }
      }

      // Apply styling
      const bgColor = levelColors[level] || levelColors[levelColors.length - 1];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: borderColor } },
          bottom: { style: 'thin', color: { argb: borderColor } },
          left: { style: 'thin', color: { argb: borderColor } },
          right: { style: 'thin', color: { argb: borderColor } }
        };
        cell.font = { name: fontName, size: fontSize, bold: level <= 1 };

        // Number formatting
        if ([5, 8, 9].includes(colNumber)) { // UnitCost, Subtotal, Total
          cell.numFmt = '#,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if ([3, 7].includes(colNumber)) { // Qty, Freq
          cell.numFmt = '0';
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if ([4, 6, 10].includes(colNumber)) { // Type, UnitCur, Currency
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
      });

      // Indent title based on level
      if (level > 0) {
        row.getCell('title').alignment = { vertical: 'middle', horizontal: 'left', indent: level };
      }
    }

    currentRow++;
  }

  // Grand Total row
  const grandTotalRow = sheet.addRow({
    index: '',
    title: 'GRAND TOTAL',
    qty: '', type: '', unitCost: '', unitCurrency: '', freq: '', subtotal: '',
    total: '',
    currency: baseCurrency
  });
  grandTotalRow.height = 28;

  const rootInfo = rowMap.get('root');
  if (rootInfo) {
    grandTotalRow.getCell('total').value = { formula: `I${rootInfo.rowNum}` };
  }

  grandTotalRow.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: greenDark } };
    cell.font = { name: fontName, size: 12, bold: true, color: { argb: white } };
    cell.border = {
      top: { style: 'medium', color: { argb: greenMedium } },
      bottom: { style: 'medium', color: { argb: greenMedium } },
      left: { style: 'thin', color: { argb: greenMedium } },
      right: { style: 'thin', color: { argb: greenMedium } }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  grandTotalRow.getCell('total').numFmt = '#,##0.00';
  grandTotalRow.getCell('total').alignment = { vertical: 'middle', horizontal: 'right' };
  grandTotalRow.getCell('title').alignment = { vertical: 'middle', horizontal: 'left' };

  // Freeze header row
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];

  // Auto-filter
  sheet.autoFilter = { from: 'A1', to: `J${currentRow}` };

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  const filename = (rootLine.title || 'Budget')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    + '_' + new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0]
    + '.xlsx';

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  return filename;
}
