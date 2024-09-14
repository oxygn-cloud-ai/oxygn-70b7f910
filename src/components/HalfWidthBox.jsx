import React from 'react';

const HalfWidthBox = ({ title, content }) => (
  <div className="w-[calc(50%-0.5rem)] border rounded-lg p-4">
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    <p>{content}</p>
  </div>
);

export default HalfWidthBox;