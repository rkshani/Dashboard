export type CalEvent = {
  id: string;
  title: string;
  /** ISO date-time, or YYYY-MM-DD for all-day events */
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  url: string | null;
};

export type NewEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM, null = all day
  durationMin: number;
  description: string | null;
};
