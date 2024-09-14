import React from 'react';

const HalfWidthBox = ({ title, content }) => (
  <div className="w-[calc(50%-0.5rem)] border rounded-lg p-4 relative">
    <span className="absolute -top-3 left-2 bg-white px-2 text-sm font-semibold text-gray-600">
      {title}
    </span>
    <p>{content}</p>
  </div>
);

export default HalfWidthBox;
