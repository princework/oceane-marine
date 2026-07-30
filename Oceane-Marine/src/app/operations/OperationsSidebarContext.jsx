"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "operations-sidebar-open";
const DEFAULT_OPEN = true;

const OperationsSidebarContext = createContext({
  isSidebarOpen: DEFAULT_OPEN,
  setIsSidebarOpen: () => {},
});

/* The sidebar preference lives in localStorage, which the server cannot see.
   Reading it during render would make the first client render disagree with the
   server HTML and trigger a hydration mismatch, so it is exposed through
   useSyncExternalStore: React renders the server snapshot, then swaps in the
   stored value after hydration without complaining. */

const listeners = new Set();

function readStoredValue() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === null ? DEFAULT_OPEN : saved === "true";
  } catch {
    // Private mode or blocked storage — fall back to the default.
    return DEFAULT_OPEN;
  }
}

function subscribe(onChange) {
  listeners.add(onChange);
  // Keep the sidebar consistent when the operator has the app open in two tabs.
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// Snapshots are booleans, so value equality is enough for React to skip re-renders.
function getSnapshot() {
  return readStoredValue();
}

function getServerSnapshot() {
  return DEFAULT_OPEN;
}

function writeStoredValue(next) {
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    /* quota or private mode — the value simply will not persist */
  }
  listeners.forEach((listener) => listener());
}

export function OperationsSidebarProvider({ children }) {
  const isSidebarOpen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setIsSidebarOpen = useCallback((value) => {
    writeStoredValue(typeof value === "function" ? value(readStoredValue()) : value);
  }, []);

  const contextValue = useMemo(
    () => ({ isSidebarOpen, setIsSidebarOpen }),
    [isSidebarOpen, setIsSidebarOpen]
  );

  return (
    <OperationsSidebarContext.Provider value={contextValue}>
      {children}
    </OperationsSidebarContext.Provider>
  );
}

export function useOperationsSidebar() {
  const context = useContext(OperationsSidebarContext);
  if (!context) {
    // Fallback for pages that don't use the context
    return { isSidebarOpen: DEFAULT_OPEN, setIsSidebarOpen: () => {} };
  }
  return context;
}
