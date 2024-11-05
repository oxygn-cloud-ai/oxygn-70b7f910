import React from 'react';

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white-200">
      <div className="text-center">
        <img 
          //src="https://static.wixstatic.com/media/611464_a195204321ec416081ffdd1660c85bde~mv2.png/v1/fill/w_196,h_40,al_c,q_85,usm_0.66_1.00_0.01,enc_auto/Cygnify-white-04.png"
          // src="/head-striped-icon.png" 
          src="cygnify-white.gif"
          alt="Striped Head Icon" 
          className="w-24 h-24 mx-auto mb-4 text-black-800"
        />
        <h1 className="text-4xl font-bold mb-4 text-black-800">Qonsol Prototype 6 for Cygnify</h1>
        <p className="text-xl text-black-600">Cygnify Prompt Library Manager</p>
      </div>
    </div>
  );
};

export default Index;
