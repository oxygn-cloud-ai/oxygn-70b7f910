import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";

const PromptBox = ({ title, initialContent }) => {
  const [content, setContent] = useState(initialContent);

  return (
    <div className="border rounded-lg p-4 h-1/3 relative mb-4">
      <span className="absolute -top-3 left-2 bg-white px-2 text-sm font-semibold text-gray-600">
        {title}
      </span>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-full resize-none"
        placeholder={`Enter content for ${title}`}
      />
    </div>
  );
};

export default PromptBox;
