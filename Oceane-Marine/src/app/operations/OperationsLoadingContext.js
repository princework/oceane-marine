"use client";

import { createContext, useContext, useState, useCallback } from "react";

const OperationsLoadingContext = createContext({
  pageLoading: false,
  setPageLoading: () => {},
});

export function OperationsLoadingProvider({ children }) {
  const [pageLoading, setPageLoadingState] = useState(false);
  const setPageLoading = useCallback((value) => {
    setPageLoadingState(Boolean(value));
  }, []);
  return (
    <OperationsLoadingContext.Provider value={{ pageLoading, setPageLoading }}>
      {children}
    </OperationsLoadingContext.Provider>
  );
}

export function useOperationsLoading() {
  return useContext(OperationsLoadingContext);
}
