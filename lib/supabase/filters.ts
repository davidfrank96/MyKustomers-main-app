export function escapePostgrestLikePattern(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&").trim();
}

export function quotePostgrestFilterValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
