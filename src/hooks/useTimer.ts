import { useState, useEffect } from 'react';

export const useTimer = (isRunning: boolean): string => {
  const [timer, setTimer] = useState<number>(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRunning) {
      interval = setInterval(() => setTimer(prevTimer => prevTimer + 10), 10);
    } else {
      if (interval) clearInterval(interval);
      setTimer(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const formatTime = (time: number): string => {
    if (time === null || time === undefined || isNaN(time)) return '0.000s';
    const seconds = Math.floor(time / 1000);
    const milliseconds = time % 1000;
    return `${seconds}.${String(milliseconds).padStart(3, '0')}s`;
  };

  return formatTime(timer);
};
