import { buildReminderSchedule, reminderMessage } from '../src/utils/reminderSchedule';

const at = (day, hour, minute = 0) => new Date(2026, 0, day, hour, minute, 0, 0);

describe('buildReminderSchedule', () => {
  test('returns nothing when no verses are due', () => {
    expect(buildReminderSchedule({ now: at(10, 9), reminderHour: 17 })).toEqual([]);
  });

  test('first reminder is today when the reminder hour has not passed', () => {
    const schedule = buildReminderSchedule({ now: at(10, 9), reminderHour: 17, overdueCount: 3 });
    expect(schedule[0].date).toEqual(at(10, 17));
    expect(schedule[0].count).toBe(3);
  });

  test('first reminder moves to tomorrow when the hour has passed', () => {
    const schedule = buildReminderSchedule({ now: at(10, 18), reminderHour: 17, overdueCount: 1 });
    expect(schedule[0].date).toEqual(at(11, 17));
  });

  test('a reminder exactly at "now" is not scheduled in the past', () => {
    const schedule = buildReminderSchedule({ now: at(10, 17), reminderHour: 17, overdueCount: 1 });
    expect(schedule[0].date).toEqual(at(11, 17));
  });

  test('overdue verses are reminded every day of the window', () => {
    const schedule = buildReminderSchedule({ now: at(10, 9), reminderHour: 17, overdueCount: 2, days: 7 });
    expect(schedule).toHaveLength(7);
    expect(schedule.every((entry) => entry.count === 2)).toBe(true);
  });

  test('upcoming verses are counted from the first reminder after they fall due', () => {
    const schedule = buildReminderSchedule({
      now: at(10, 9),
      reminderHour: 17,
      upcoming: [at(10, 20).toISOString(), at(12, 8).toISOString()],
      days: 4,
    });
    // Jan 10 17:00 → nothing due yet, so no entry; Jan 11 → 1; Jan 12 and 13 → 2
    expect(schedule.map((entry) => [entry.date.getDate(), entry.count])).toEqual([
      [11, 1],
      [12, 2],
      [13, 2],
    ]);
  });

  test('ignores unparseable due-times', () => {
    const schedule = buildReminderSchedule({ now: at(10, 9), reminderHour: 17, upcoming: ['not-a-date'] });
    expect(schedule).toEqual([]);
  });

  test('crosses month boundaries', () => {
    const schedule = buildReminderSchedule({
      now: new Date(2026, 0, 30, 20),
      reminderHour: 8,
      overdueCount: 1,
      days: 3,
    });
    expect(schedule.map((entry) => [entry.date.getMonth(), entry.date.getDate()])).toEqual([
      [0, 31],
      [1, 1],
      [1, 2],
    ]);
  });
});

describe('reminderMessage', () => {
  test('uses the Arabic singular, dual and plural forms', () => {
    expect(reminderMessage('سارة', 1)).toContain('آية واحدة');
    expect(reminderMessage('سارة', 2)).toContain('آيتان');
    expect(reminderMessage('سارة', 5)).toContain('5 آيات');
    expect(reminderMessage('سارة', 25)).toContain('25 آية');
  });
});
