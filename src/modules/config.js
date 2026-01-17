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
      'rgba(255,255,255,0.02)',
      'rgba(255,255,255,0.08)',
      'rgba(255,255,255,0.12)',
      'rgba(255,255,255,0.16)',
      'rgba(255,255,255,0.2)'
    ],
    warnBeforeDelete: false
  }
};
