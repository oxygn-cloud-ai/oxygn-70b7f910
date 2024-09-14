import React from 'react';

const PromptBox = ({ title }) => (
  <div className="border rounded-lg p-4 h-1/3 relative mb-4">
    <span className="absolute -top-3 left-2 bg-white px-2 text-sm font-semibold text-gray-600">
      {title}
    </span>
    <p>Content for the {title.toLowerCase()} box goes here.</p>
  </div>
);

export default PromptBox;