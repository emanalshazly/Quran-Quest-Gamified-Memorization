/**
 * Pure scheduling logic for review reminders (no React Native imports, so it
 * can be unit-tested on its own).
 *
 * One reminder per day at the family's chosen hour, for every day on which
 * the kid has verses waiting. Counts are cumulative: verses left unreviewed
 * keep being counted on the following days, so reminders continue until the
 * reviews are done (the schedule is rebuilt after every review).
 */

export const DEFAULT_REMINDER_HOUR = 17;
export const REMINDER_DAYS_AHEAD = 7;

/**
 * @param {Object} params
 * @param {Date}   params.now           current time
 * @param {number} params.reminderHour  local hour of day (0-23)
 * @param {number} params.overdueCount  verses already due
 * @param {string[]} params.upcoming    ISO due-times of verses not yet due
 * @param {number} [params.days]        how many reminder days to plan
 * @returns {{ date: Date, count: number }[]}
 */
export const buildReminderSchedule = ({
  now,
  reminderHour,
  overdueCount = 0,
  upcoming = [],
  days = REMINDER_DAYS_AHEAD,
}) => {
  const dueTimes = upcoming.map((iso) => new Date(iso).getTime()).filter(Number.isFinite);

  const first = new Date(now);
  first.setHours(reminderHour, 0, 0, 0);
  if (first.getTime() <= now.getTime()) {
    first.setDate(first.getDate() + 1);
  }

  const schedule = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(first);
    date.setDate(first.getDate() + i);
    const count = overdueCount + dueTimes.filter((t) => t <= date.getTime()).length;
    if (count > 0) {
      schedule.push({ date, count });
    }
  }
  return schedule;
};

export const reminderMessage = (kidName, count) => {
  if (count === 1) return `${kidName}، آية واحدة تنتظر مراجعتك اليوم 🌟`;
  if (count === 2) return `${kidName}، آيتان تنتظران مراجعتك اليوم 🌟`;
  if (count <= 10) return `${kidName}، ${count} آيات تنتظر مراجعتك اليوم 🌟`;
  return `${kidName}، ${count} آية تنتظر مراجعتك اليوم 🌟`;
};
