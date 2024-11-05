import React from 'react';

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="mb-4">
          <img 
            src="head-striped-icon-wht.png"
            alt="Qonsol" 
            className="w-[5%] mx-auto"
          />
          <p></p>
        </div>
        <div className="mb-4">
          <img 
            src="cygnify-white.gif"
            alt="Cygnify" 
            className="w-[20%] mx-auto"
          />
        </div>
        <h1 className="text-4xl font-bold mb-4 text-white">Qonsol Prototype 6</h1>
        <p className="text-xl text-gray-300 mb-4">Prompt Library Manager</p>
      </div>
    </div>
  );
};

export default Index;
