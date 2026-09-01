"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type FieldErrors = Record<string, string[] | undefined> | undefined;

export function useFormErrorNavigation(
  fieldErrors: FieldErrors,
  fieldOrder: readonly string[],
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [clearedState, setClearedState] = useState<{
    source: FieldErrors;
    fields: Set<string>;
  }>(() => ({ source: undefined, fields: new Set() }));
  useEffect(() => {
    const firstInvalidField = fieldOrder.find((field) => fieldErrors?.[field]?.length);

    if (!firstInvalidField) return;

    const frame = window.requestAnimationFrame(() => {
      const form = formRef.current;
      const control =
        form?.querySelector<HTMLElement>(`#${firstInvalidField}`) ??
        form?.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`);
      if (!control) return;

      control.scrollIntoView?.({ behavior: "smooth", block: "center" });
      control.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [fieldErrors, fieldOrder]);

  const visibleFieldErrors = useMemo(() => {
    if (!fieldErrors) return undefined;
    const clearedFields =
      clearedState.source === fieldErrors ? clearedState.fields : new Set<string>();

    return Object.fromEntries(
      Object.entries(fieldErrors).filter(
        (entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) && !clearedFields.has(entry[0]),
      ),
    );
  }, [clearedState, fieldErrors]);

  function clearFieldError(field: string) {
    if (!fieldErrors?.[field]?.length) return;
    setClearedState((current) => ({
      source: fieldErrors,
      fields: new Set(current.source === fieldErrors ? current.fields : []).add(field),
    }));
  }

  function onInputCapture(event: React.FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const field = target.name || target.id;
    if (field) clearFieldError(field);
  }

  return {
    formRef,
    visibleFieldErrors,
    clearFieldError,
    onInputCapture,
    onChangeCapture: onInputCapture,
  };
}
