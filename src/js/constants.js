/**
 * Frozen enum constants for todo status and priority.
 * 3-letter acronyms map directly to DB ENUM columns without transformation.
 */

export const STATUS = Object.freeze({
  NYS: 'NYS',
  INP: 'INP',
  INR: 'INR',
  BLK: 'BLK',
  CMP: 'CMP',
  CAN: 'CAN',
  DEF: 'DEF'
});

export const STATUS_LABELS = Object.freeze({
  NYS: 'Not Yet Started',
  INP: 'In Progress',
  INR: 'In Review',
  BLK: 'Blocked',
  CMP: 'Complete',
  CAN: 'Cancelled',
  DEF: 'Deferred'
});

export const STATUS_COLOURS = Object.freeze({
  NYS: 'grey',
  INP: 'blue',
  INR: 'amber',
  BLK: 'red',
  CMP: 'green',
  CAN: 'muted',
  DEF: 'purple'
});

export const PRIORITY = Object.freeze({
  LOW:  'LOW',
  MED:  'MED',
  HIGH: 'HIGH',
  CRIT: 'CRIT'
});

export const PRIORITY_LABELS = Object.freeze({
  LOW:  'Low',
  MED:  'Medium',
  HIGH: 'High',
  CRIT: 'Critical'
});

export const PRIORITY_COLOURS = Object.freeze({
  LOW:  'slate',
  MED:  'sky',
  HIGH: 'orange',
  CRIT: 'red'
});

/** Statuses that lock a todo item. `completed_at` auto-sets on transition to these. */
export const TERMINAL_STATUSES = Object.freeze([STATUS.CMP, STATUS.CAN]);
