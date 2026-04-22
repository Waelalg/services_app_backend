import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(customParseFormat);
dayjs.extend(utc);

export const DATE_FORMAT = 'YYYY-MM-DD';
export const TIME_FORMAT = 'HH:mm';

export function isValidDateString(value) {
  return dayjs.utc(value, DATE_FORMAT, true).isValid();
}

export function isValidTimeString(value) {
  return dayjs.utc(value, TIME_FORMAT, true).isValid();
}

export function toUtcDateOnly(value) {
  return dayjs.utc(value, DATE_FORMAT, true).startOf('day').toDate();
}

export function formatDateOnly(value) {
  return value ? dayjs.utc(value).format(DATE_FORMAT) : null;
}

export function formatDateTime(value) {
  return value ? dayjs.utc(value).toISOString() : null;
}

export function getDayOfWeek(dateString) {
  return dayjs.utc(dateString, DATE_FORMAT, true).day();
}

export function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mins = String(normalized % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

export function isStartBeforeEnd(startTime, endTime) {
  return timeToMinutes(startTime) < timeToMinutes(endTime);
}

export function addMinutesToTime(timeString, minutes) {
  return minutesToTime(timeToMinutes(timeString) + minutes);
}

export function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

export function getDayBoundaries(dateString) {
  const dayStart = dayjs.utc(dateString, DATE_FORMAT, true).startOf('day');
  const dayEnd = dayStart.add(1, 'day');

  return { dayStart, dayEnd };
}

export function projectDateTimeRangeToDay(startDateTime, endDateTime, dateString) {
  const { dayStart, dayEnd } = getDayBoundaries(dateString);
  const start = dayjs.utc(startDateTime);
  const end = dayjs.utc(endDateTime);

  if (!start.isBefore(dayEnd) || !end.isAfter(dayStart)) {
    return null;
  }

  const effectiveStart = start.isAfter(dayStart) ? start : dayStart;
  const effectiveEnd = end.isBefore(dayEnd) ? end : dayEnd;

  return {
    startMinutes: effectiveStart.diff(dayStart, 'minute'),
    endMinutes: effectiveEnd.diff(dayStart, 'minute')
  };
}
