"use client";

import { createContext, useContext, useState, useCallback } from "react";

const HrLoadingContext = createContext({
  pageLoading: false,
  setPageLoading: () => {},
});

export function HrLoadingProvider({ children }) {
  const [pageLoading, setPageLoadingState] = useState(false);
  const setPageLoading = useCallback((value) => {
    setPageLoadingState(Boolean(value));
  }, []);
  return (
    <HrLoadingContext.Provider value={{ pageLoading, setPageLoading }}>
      {children}
    </HrLoadingContext.Provider>
  );
}

export function useHrLoading() {
  return useContext(HrLoadingContext);
}
