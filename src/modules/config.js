'use strict';

export const config = {
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
      'rgba(255,255,255,0.5)',
      'rgba(255,255,255,0.65)'
    ],
    warnBeforeDelete: false
  }
};
