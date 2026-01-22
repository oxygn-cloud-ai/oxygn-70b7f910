import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface TooltipContextValue {
  tooltipsEnabled: boolean;
  toggleTooltips: () => void;
}

const TooltipContext = createContext<TooltipContextValue>({
  tooltipsEnabled: true,
  toggleTooltips: () => {},
});

export const useTooltipSettings = (): TooltipContextValue => useContext(TooltipContext);

interface TooltipSettingsProviderProps {
  children: ReactNode;
}

export const TooltipSettingsProvider = ({ children }: TooltipSettingsProviderProps) => {
  const [tooltipsEnabled, setTooltipsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('tooltipsEnabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    localStorage.setItem('tooltipsEnabled', JSON.stringify(tooltipsEnabled));
  }, [tooltipsEnabled]);

  const toggleTooltips = (): void => {
    setTooltipsEnabled(prev => !prev);
  };

  return (
    <TooltipContext.Provider value={{ tooltipsEnabled, toggleTooltips }}>
      {children}
    </TooltipContext.Provider>
  );
};
