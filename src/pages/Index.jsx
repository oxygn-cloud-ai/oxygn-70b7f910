import React from 'react';

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-secondary/90 to-accent/20">
      <div className="text-center space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="relative">
            <img 
              src="/head-striped-icon-wht.png"
              alt="Qonsol" 
              className="w-16 h-16 drop-shadow-lg"
            />
            <div className="absolute -inset-2 bg-primary/20 rounded-full blur-xl -z-10" />
          </div>
        </div>

        {/* Animated Logo */}
        <div className="flex justify-center">
          <img 
            src="/cygnify-white.gif"
            alt="Cygnify" 
            className="h-8 opacity-90"
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
