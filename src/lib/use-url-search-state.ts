import { useState, useEffect, useCallback } from "react";

function getSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

function updateSearchParam(key: string, value: string | null, replace = true) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value === null || value === undefined || value === "") {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }

  const newUrl =
    url.pathname +
    (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
    url.hash;
  const currentUrl = window.location.pathname + window.location.search + window.location.hash;

  if (newUrl !== currentUrl) {
    if (replace) {
      window.history.replaceState(window.history.state, "", newUrl);
    } else {
      window.history.pushState(window.history.state, "", newUrl);
    }
    // Dispatch popstate event to inform other hooks listening on URL changes
    window.dispatchEvent(new Event("popstate"));
  }
}

/**
 * Hook to persist a boolean modal / sidesheet / dialog state in the URL search params.
 * e.g. ?support=open or ?notifications=open or ?dialog=editProfile
 */
export function useUrlBooleanState(
  paramKey: string,
  defaultOpen = false,
  options?: { openValue?: string; replace?: boolean },
): [boolean, (open: boolean | ((prev: boolean) => boolean)) => void] {
  const openValue = options?.openValue ?? "open";
  const shouldReplace = options?.replace ?? true;

  const readStateFromUrl = useCallback(() => {
    const param = getSearchParam(paramKey);
    if (param === null) return defaultOpen;
    return param === openValue || param === "true" || param === "1";
  }, [paramKey, defaultOpen, openValue]);

  const [isOpen, setIsOpenState] = useState<boolean>(readStateFromUrl);

  useEffect(() => {
    const handleUrlChange = () => {
      setIsOpenState(readStateFromUrl());
    };

    window.addEventListener("popstate", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
    };
  }, [readStateFromUrl]);

  const setIsOpen = useCallback(
    (action: boolean | ((prev: boolean) => boolean)) => {
      setIsOpenState((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        updateSearchParam(paramKey, next ? openValue : null, shouldReplace);
        return next;
      });
    },
    [paramKey, openValue, shouldReplace],
  );

  return [isOpen, setIsOpen];
}

/**
 * Hook to persist a string/ID modal / sidesheet / dialog state in the URL search params.
 * e.g. ?ticketId=123 or ?userId=456 or ?manageUser=789 or ?notificationId=abc
 */
export function useUrlStringState(
  paramKey: string,
  defaultValue: string | null = null,
  options?: { replace?: boolean },
): [string | null, (val: string | null | ((prev: string | null) => string | null)) => void] {
  const shouldReplace = options?.replace ?? true;

  const readStateFromUrl = useCallback(() => {
    const param = getSearchParam(paramKey);
    return param !== null && param !== "" ? param : defaultValue;
  }, [paramKey, defaultValue]);

  const [value, setValueState] = useState<string | null>(readStateFromUrl);

  useEffect(() => {
    const handleUrlChange = () => {
      setValueState(readStateFromUrl());
    };

    window.addEventListener("popstate", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
    };
  }, [readStateFromUrl]);

  const setValue = useCallback(
    (action: string | null | ((prev: string | null) => string | null)) => {
      setValueState((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        updateSearchParam(paramKey, next, shouldReplace);
        return next;
      });
    },
    [paramKey, shouldReplace],
  );

  return [value, setValue];
}
