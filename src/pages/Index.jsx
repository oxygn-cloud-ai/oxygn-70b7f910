import React from 'react';
import chocolateFullLogo from '@/assets/chocolate-full-logo.png';

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-secondary/90 to-accent/20">
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
          <h1 className="text-4xl font-bold text-secondary-foreground tracking-tight">
            Qonsol Policy Builder
            <span className="text-primary ml-2">7</span>
          </h1>
          <p className="text-lg text-secondary-foreground/70">
            Prompt Library Manager
          </p>
        </div>

        {/* Tagline */}
        <div className="pt-4">
          <span className="inline-block px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-sm tracking-wide">
            Take Control
          </span>
        </div>

        {/* Decorative elements */}
        <div className="flex justify-center gap-1.5 pt-6 opacity-40">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
};

export default Index;
