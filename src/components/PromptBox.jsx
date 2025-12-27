import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";

const PromptBox = ({ title, initialContent }) => {
  const [content, setContent] = useState(initialContent);

  return (
    <div className="border border-outline-variant rounded-2xl p-4 h-1/3 relative mb-4 bg-surface-container transition-all duration-medium-2 ease-standard">
      <span className="absolute -top-3 left-3 bg-surface-container px-2 text-label-medium font-medium text-on-surface-variant z-10">
        {title}
      </span>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-full resize-none bg-transparent border-0 focus-visible:ring-0 text-body-medium text-on-surface placeholder:text-on-surface-variant/60"
        placeholder={`Enter content for ${title}`}
      />
    </div>
  );
};

export default PromptBox;
