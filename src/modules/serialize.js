'use strict';

import { Line, Overhead } from './Line.js';

export const exportToJSON = (line, outputAsObject, propertiesToExport) => {
  propertiesToExport = propertiesToExport || [
    'index', 'title', 'unitNumber', 'unitType', 'unitCost', 'unitCurrency',
    'frequency', 'cost', 'total', 'currency', 'start', 'end', 'created', 'modified'
  ];
  const lineHasChildren = line.children && line.children.length;
  const exportObject = {};
  for (let i = 0; i < propertiesToExport.length; i++) {
    const property = propertiesToExport[i];
    if (line[property] || property === 'index') {
      if (['unitNumber', 'unitType', 'unitCost', 'unitCurrency', 'frequency', 'cost']
          .includes(property)) {
        if (!lineHasChildren) exportObject[property] = line[property];
      } else exportObject[property] = line[property];
    }
  }

  // Export overheads
  if (line.overhead?.length > 0) {
    exportObject.overhead = line.overhead.map(oh => ({
      title: oh._title,
      percentage: oh._percentage,
      currency: oh._currency
    }));
  }

  if (lineHasChildren) {
    exportObject.children = [];
    for (let i = 0; i < line.children.length; i++) {
      let childObject = exportToJSON(line.children[i], true);
      exportObject.children.push(childObject);
    }
  }
  return outputAsObject ? exportObject : JSON.stringify(exportObject);
};

export const cloneLine = (line) => {
  const isLine = line instanceof Line;
  const clone = (isLine) ?
    exportToJSON(line, true, ['level', 'title', 'unitNumber',
      'unitType', 'unitCost', 'unitCurrency', 'frequency', 'currency', 'start', 'end',
      'created', 'modified']) :
    line;
  const newLine = new Line();

  // Clone children first
  if (clone.children && clone.children.length) {
    for (let i = 0; i < clone.children.length; i++) {
      const cloneChild = cloneLine(clone.children[i]);
      newLine.addLine(cloneChild);
    }
  }

  // Properties that are computed (getters only) and should not be set
  const computedProperties = ['cost', 'total', 'level', 'index', 'children',
    'levelName', 'lineNumber', 'absLineNumber', 'root', 'ancestors', 'siblings',
    'descendants', 'before', 'after', 'duration', 'defaultTitle', 'currencies',
    'overhead', 'overheadTotal', 'totalWithoutOverhead'];

  for (let property in clone) {
    if (clone.hasOwnProperty(property) && clone[property] !== undefined &&
        !computedProperties.includes(property)) {
      newLine[property] = clone[property];
    }
  }

  // Restore overheads
  if (clone.overhead?.length > 0) {
    for (const ohData of clone.overhead) {
      newLine.addOverhead({
        title: ohData.title,
        percentage: ohData.percentage,
        currency: ohData.currency
      });
    }
  }

  return newLine;
};
