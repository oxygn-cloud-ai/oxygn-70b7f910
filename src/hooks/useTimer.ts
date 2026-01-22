import { useState, useEffect } from 'react';

export const useTimer = (isRunning) => {
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => setTimer(prevTimer => prevTimer + 10), 10);
    } else {
      clearInterval(interval);
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (time) => {
    if (time === null || time === undefined || isNaN(time)) return '0.000s';
    const seconds = Math.floor(time / 1000);
    const milliseconds = time % 1000;
    return `${seconds}.${String(milliseconds).padStart(3, '0')}s`;
  };

  return formatTime(timer);
};