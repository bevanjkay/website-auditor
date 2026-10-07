const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const shortDateFormatter = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const relativeSteps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

function toDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | Date | null | undefined, fallback = "—") {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : fallback;
}

export function formatDate(value: string | Date | null | undefined, fallback = "—") {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : fallback;
}

export function formatShortDate(value: string | Date | null | undefined, fallback = "—") {
  const date = toDate(value);
  return date ? shortDateFormatter.format(date) : fallback;
}

export function formatRelativeTime(value: string | Date | null | undefined, fallback = "—") {
  const date = toDate(value);
  if (!date) {
    return fallback;
  }

  let delta = (date.getTime() - Date.now()) / 1000;
  for (const [unit, size] of relativeSteps) {
    if (Math.abs(delta) < size) {
      return relativeFormatter.format(Math.round(delta), unit);
    }
    delta /= size;
  }

  return dateTimeFormatter.format(date);
}

export function formatDuration(start: string | Date | null | undefined, end: string | Date | null | undefined) {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}
