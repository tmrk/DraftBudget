'use strict';

import ExcelJS from 'exceljs';
import { config } from './config.js';

/**
 * Export a budget line and all its descendants to Excel
 * Parent rows use SUM formulas to total their children
 */
export async function exportToExcel(rootLine) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DraftBudget';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(rootLine.title || 'Budget', {
    properties: {
      defaultRowHeight: 22
    },
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  // Define styles
  const fontName = 'Arial';
  const fontSize = 11;

  const defaultStyle = {
    font: { name: fontName, size: fontSize },
    alignment: { vertical: 'middle' }
  };

  const centerStyle = {
    font: { name: fontName, size: fontSize },
    alignment: { vertical: 'middle', horizontal: 'center' }
  };

  const rightStyle = {
    font: { name: fontName, size: fontSize },
    alignment: { vertical: 'middle', horizontal: 'right' }
  };

  const currencyStyle = {
    font: { name: fontName, size: fontSize },
    alignment: { vertical: 'middle', horizontal: 'right' },
    numFmt: '#,##0.00'
  };

  const integerStyle = {
    font: { name: fontName, size: fontSize },
    alignment: { vertical: 'middle', horizontal: 'center' },
    numFmt: '0'
  };

  // Define columns matching the UI
  sheet.columns = [
    { header: '#', key: 'index', width: 10, style: defaultStyle },
    { header: 'Title', key: 'title', width: 35, style: defaultStyle },
    { header: 'Qty', key: 'qty', width: 8, style: integerStyle },
    { header: 'Type', key: 'type', width: 8, style: centerStyle },
    { header: 'Rate', key: 'rate', width: 12, style: currencyStyle },
    { header: 'Cost', key: 'cost', width: 14, style: currencyStyle },
    { header: 'Fr', key: 'freq', width: 6, style: integerStyle },
    { header: 'Total', key: 'total', width: 14, style: currencyStyle },
    { header: 'Cur', key: 'currency', width: 6, style: centerStyle }
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { name: fontName, size: fontSize, bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' }
    };
    cell.font = { name: fontName, size: fontSize, bold: true, color: { argb: 'FFFFFF' } };
    cell.border = {
      top: { style: 'thin', color: { argb: '2F5496' } },
      bottom: { style: 'thin', color: { argb: '2F5496' } },
      left: { style: 'thin', color: { argb: '2F5496' } },
      right: { style: 'thin', color: { argb: '2F5496' } }
    };
  });

  // Level background colors (light to dark based on depth)
  const levelColors = ['D6DCE5', 'E2EFDA', 'FFF2CC', 'FCE4D6', 'EDEDED'];

  // Track row numbers for SUM formulas
  // Key: line index (e.g., "1.1"), Value: { rowNum, childRows: [] }
  const rowMap = new Map();

  /**
   * Recursively collect all lines in order, tracking parent-child relationships
   */
  function collectLines(line, parentIndex = null) {
    const lines = [];

    if (line.index !== 0) { // Skip root for index, but include in output
      lines.push({ line, parentIndex });
    } else {
      lines.push({ line, parentIndex, isRoot: true });
    }

    if (line.children && line.children.length > 0) {
      for (const child of line.children) {
        lines.push(...collectLines(child, line.index || 'root'));
      }
    }

    return lines;
  }

  const allLines = collectLines(rootLine);

  // First pass: add all rows and track row numbers
  let currentRow = 2; // Start after header

  for (const { line, parentIndex, isRoot } of allLines) {
    const hasChildren = line.children && line.children.length > 0;
    const level = line.level || 0;
    const lineIndex = isRoot ? 'root' : line.index;

    // Add row data
    const rowData = {
      index: isRoot ? '' : line.index,
      title: line.title,
      qty: hasChildren ? '' : (line.unitNumber || ''),
      type: hasChildren ? '' : (line.unitType || ''),
      rate: hasChildren ? '' : (line.unitCost || 0),
      freq: hasChildren ? '' : (line.frequency || ''),
      cost: '', // Will be set with formula or value
      total: '', // Will be set with formula or value
      currency: line.currency || config.default.currency
    };

    const row = sheet.addRow(rowData);
    row.height = 22;

    // Track this row
    rowMap.set(lineIndex, {
      rowNum: currentRow,
      childRows: [],
      hasChildren,
      level
    });

    // Register with parent
    if (parentIndex !== null && rowMap.has(parentIndex)) {
      rowMap.get(parentIndex).childRows.push(currentRow);
    }

    currentRow++;
  }

  // Second pass: apply formulas and styling
  currentRow = 2;

  for (const { line, isRoot } of allLines) {
    const row = sheet.getRow(currentRow);
    const lineIndex = isRoot ? 'root' : line.index;
    const info = rowMap.get(lineIndex);
    const hasChildren = info.hasChildren;
    const level = info.level;

    // Cost column (G) - for leaf nodes: Qty * Rate
    const costCell = row.getCell('cost');
    // Total column (H) - for parent nodes: SUM of children's totals, for leaf: Cost * Freq
    const totalCell = row.getCell('total');

    if (hasChildren && info.childRows.length > 0) {
      // Parent row: use SUM formula for total column
      // Find direct children's total cells
      const childTotalRefs = info.childRows.map(r => `H${r}`).join(',');
      totalCell.value = { formula: `SUM(${childTotalRefs})` };

      // Cost is blank for parent rows
      costCell.value = '';
    } else {
      // Leaf row: Cost = Qty * Rate, Total = Cost * Freq
      const qtyCell = row.getCell('qty');
      const rateCell = row.getCell('rate');
      const freqCell = row.getCell('freq');

      // Set actual values for leaf rows
      qtyCell.value = line.unitNumber || 0;
      rateCell.value = line.unitCost || 0;
      freqCell.value = line.frequency || 1;

      // Cost formula: Qty * Rate (C * E -> F)
      costCell.value = { formula: `C${currentRow}*E${currentRow}` };

      // Total formula: Cost * Freq (F * G -> H)
      totalCell.value = { formula: `F${currentRow}*G${currentRow}` };
    }

    // Apply background color based on level
    const bgColor = levelColors[level] || levelColors[levelColors.length - 1];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
        left: { style: 'thin', color: { argb: 'CCCCCC' } },
        right: { style: 'thin', color: { argb: 'CCCCCC' } }
      };

      // Bold for level 0 and 1
      if (level <= 1) {
        cell.font = { name: fontName, size: fontSize, bold: true };
      }
    });

    // Indent title based on level
    const titleCell = row.getCell('title');
    if (level > 0) {
      titleCell.alignment = {
        vertical: 'middle',
        horizontal: 'left',
        indent: level
      };
    }

    currentRow++;
  }

  // Add Grand Total row
  const grandTotalRow = sheet.addRow({
    index: '',
    title: 'GRAND TOTAL',
    qty: '',
    type: '',
    rate: '',
    freq: '',
    cost: '',
    total: '', // Will use formula
    currency: rootLine.currency || config.default.currency
  });

  grandTotalRow.height = 28;

  // Grand total formula: same as root's total
  const rootInfo = rowMap.get('root');
  if (rootInfo) {
    grandTotalRow.getCell('total').value = { formula: `H${rootInfo.rowNum}` };
  }

  // Style grand total row
  grandTotalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' }
    };
    cell.font = { name: fontName, size: 12, bold: true, color: { argb: 'FFFFFF' } };
    cell.border = {
      top: { style: 'medium', color: { argb: '2F5496' } },
      bottom: { style: 'medium', color: { argb: '2F5496' } },
      left: { style: 'thin', color: { argb: '2F5496' } },
      right: { style: 'thin', color: { argb: '2F5496' } }
    };
  });

  // Freeze header row
  sheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
  ];

  // Auto-filter
  sheet.autoFilter = {
    from: 'A1',
    to: `I${currentRow}`
  };

  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  const filename = (rootLine.title || 'Budget')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    + '_'
    + new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0]
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
