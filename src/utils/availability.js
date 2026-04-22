import {
  addMinutesToTime,
  getDayOfWeek,
  intervalsOverlap,
  projectDateTimeRangeToDay,
  timeToMinutes
} from './date-time.js';

export function buildAvailableSlots({ dateString, rules, timeOff, confirmedBookings }) {
  const dayOfWeek = getDayOfWeek(dateString);
  const matchingRules = (rules || [])
    .filter((rule) => rule.isActive && rule.dayOfWeek === dayOfWeek)
    .sort((left, right) => {
      if (left.startTime === right.startTime) {
        return left.endTime.localeCompare(right.endTime);
      }
      return left.startTime.localeCompare(right.startTime);
    });

  const blockedIntervals = [
    ...(timeOff || [])
      .map((item) => projectDateTimeRangeToDay(item.startDateTime, item.endDateTime, dateString))
      .filter(Boolean),
    ...(confirmedBookings || []).map((booking) => ({
      startMinutes: timeToMinutes(booking.slotStart),
      endMinutes: timeToMinutes(booking.slotEnd)
    }))
  ];

  const seen = new Set();
  const slots = [];

  for (const rule of matchingRules) {
    const startMinutes = timeToMinutes(rule.startTime);
    const endMinutes = timeToMinutes(rule.endTime);

    for (
      let slotStartMinutes = startMinutes;
      slotStartMinutes + rule.slotDurationMinutes <= endMinutes;
      slotStartMinutes += rule.slotDurationMinutes
    ) {
      const slotEndMinutes = slotStartMinutes + rule.slotDurationMinutes;
      const overlaps = blockedIntervals.some((interval) =>
        intervalsOverlap(slotStartMinutes, slotEndMinutes, interval.startMinutes, interval.endMinutes)
      );

      if (overlaps) {
        continue;
      }

      const slotStart = addMinutesToTime('00:00', slotStartMinutes);
      const slotEnd = addMinutesToTime('00:00', slotEndMinutes);
      const key = `${slotStart}-${slotEnd}`;

      if (!seen.has(key)) {
        seen.add(key);
        slots.push({
          slotStart,
          slotEnd,
          slotDurationMinutes: rule.slotDurationMinutes
        });
      }
    }
  }

  return slots.sort((left, right) => left.slotStart.localeCompare(right.slotStart));
}
