import React, { createContext, useContext, useState } from 'react';

// Define the shape of our context
interface DataVersionContextType {
  dataVersion: number;
  incrementVersion: () => void;
}

// Create the context with a default value
const DataVersionContext = createContext<DataVersionContextType | undefined>(undefined);

// Provider component
export function DataVersionProvider({ children }: { children: React.ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);

  const incrementVersion = () => {
    setDataVersion(prev => prev + 1);
  };

  const value = {
    dataVersion,
    incrementVersion
  };

  return (
    <DataVersionContext.Provider value={value}>
      {children}
    </DataVersionContext.Provider>
  );
}

// Custom hook for using this context
export function useDataVersion() {
  const context = useContext(DataVersionContext);
  if (context === undefined) {
    throw new Error('useDataVersion must be used within a DataVersionProvider');
  }
  return context;
}