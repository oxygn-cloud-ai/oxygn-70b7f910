import { createContext, useContext, useState, useEffect } from 'react';

const TooltipContext = createContext({
  tooltipsEnabled: true,
  toggleTooltips: () => {},
});

export const useTooltipSettings = () => useContext(TooltipContext);

export const TooltipSettingsProvider = ({ children }) => {
  const [tooltipsEnabled, setTooltipsEnabled] = useState(() => {
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

  const toggleTooltips = () => {
    setTooltipsEnabled(prev => !prev);
  };

  return (
    <TooltipContext.Provider value={{ tooltipsEnabled, toggleTooltips }}>
      {children}
    </TooltipContext.Provider>
  );
};
