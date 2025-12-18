import React from 'react';
import chocolateFullLogo from '@/assets/chocolate-full-logo.png';

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src={chocolateFullLogo}
            alt="Chocolate Finance" 
            className="h-20 object-contain"
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            Qonsol Policy Builder
            <span className="text-primary ml-2">7</span>
          </h1>
        </div>

        {/* Decorative elements */}
        <div className="flex justify-center gap-1.5 pt-6 opacity-60">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
};

export default Index;
