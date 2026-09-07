const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function formatDisplayDateTime(value: string | Date) {
  const parts = dateTimeFormatter.formatToParts(
    typeof value === "string" ? new Date(value) : value,
  );

  return `${partValue(parts, "month")} ${partValue(parts, "day")}, ${partValue(parts, "year")}, ${partValue(parts, "hour")}:${partValue(parts, "minute")} ${partValue(parts, "dayPeriod")}`;
}

export function formatDisplayDate(value: string | Date) {
  const parts = dateFormatter.formatToParts(
    typeof value === "string" ? new Date(value) : value,
  );

  return `${partValue(parts, "month")} ${partValue(parts, "day")}, ${partValue(parts, "year")}`;
}
