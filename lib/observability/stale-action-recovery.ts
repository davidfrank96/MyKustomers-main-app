const RECOVERY_KEY = "myk:stale-action-recovery:v1";

export function isUnrecognizedServerAction(error: Error) {
  return (
    error.name === "UnrecognizedActionError" &&
    /^Server Action "[a-f0-9]{42}" was not found on the server\./.test(error.message)
  );
}

/** At most one automatic recovery per tab; never persist a route or form data. */
export function claimStaleActionRecovery(
  error: Error,
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  if (!isUnrecognizedServerAction(error)) return false;
  try {
    if (storage.getItem(RECOVERY_KEY) !== null) return false;
    storage.setItem(RECOVERY_KEY, "attempted");
    return storage.getItem(RECOVERY_KEY) === "attempted";
  } catch {
    // Without a durable loop guard, leave the normal error UI in control.
    return false;
  }
}
