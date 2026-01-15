'use strict';

import { Line } from './Line.js';

export const exportToJSON = (line, outputAsObject, propertiesToExport) => {
  propertiesToExport = propertiesToExport || [
    'index', 'title', 'unitNumber', 'unitType', 'unitCost', 'frequency', 'cost',
    'total', 'currency', 'start', 'end', 'created', 'modified'
  ];
  const lineHasChildren = line.children && line.children.length;
  const exportObject = {};
  for (let i = 0; i < propertiesToExport.length; i++) {
    const property = propertiesToExport[i];
    if (line[property] || property === 'index') {
      if (['unitNumber', 'unitType', 'unitCost', 'frequency', 'cost']
          .includes(property)) {
        if (!lineHasChildren) exportObject[property] = line[property];
      } else exportObject[property] = line[property];
    }
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
      'unitType', 'unitCost', 'frequency', 'currency', 'start', 'end',
      'created', 'modified']) :
    line;
  const newLine = new Line();
  if (clone.children && clone.children.length) {
    for (let i = 0; i < clone.children.length; i++) {
      const cloneChild = cloneLine(clone.children[i]);
      newLine.addLine(cloneChild);
    }
  }
  for (let property in clone) {
    if (clone.hasOwnProperty(property) && clone[property] &&
        property !== 'level' && property !== 'index' && property !== 'children') {
      newLine[property] = clone[property];
    }
  }
  return newLine;
};
