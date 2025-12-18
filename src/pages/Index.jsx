import React from 'react';
import chocolateFullLogo from '@/assets/chocolate-full-logo.png';
import chocolateBackground from '@/assets/chocolate-background.jpg';

const Index = () => {
  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${chocolateBackground})` }}
    >
      <div className="text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src={chocolateFullLogo}
            alt="Chocolate Finance" 
            className="h-20 object-contain drop-shadow-lg"
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight drop-shadow-lg">
            Qonsol Policy Builder
            <span className="text-primary ml-2">7</span>
          </h1>
        </div>

        {/* Decorative elements */}
        <div className="flex justify-center gap-1.5 pt-6 opacity-60">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
};

export default Index;
