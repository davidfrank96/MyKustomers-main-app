export const NOTIFICATION_READ_RETENTION_MS = 72 * 60 * 60 * 1000;

export function notificationReadCutoff(now = Date.now()) {
  return new Date(now - NOTIFICATION_READ_RETENTION_MS).toISOString();
}

// The existing minute scheduler keeps generating overdue events and sending
// push every minute. Historical maintenance gets four bounded opportunities/hour.
export function isNotificationMaintenanceMinute(now = new Date()) {
  return now.getUTCMinutes() % 15 === 0;
}
