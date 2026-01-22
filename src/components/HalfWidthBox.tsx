import React, { useState, ChangeEvent } from 'react';
import { Textarea } from "@/components/ui/textarea";

interface HalfWidthBoxProps {
  title: string;
  initialContent?: string;
}

const HalfWidthBox: React.FC<HalfWidthBoxProps> = ({ title, initialContent = '' }) => {
  const [content, setContent] = useState<string>(initialContent);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  return (
    <div className="w-[calc(50%-0.5rem)] border border-outline-variant rounded-m3-md p-4 relative">
      <span className="absolute -top-3 left-2 bg-surface px-2 text-body-sm font-semibold text-on-surface-variant z-10">
        {title}
      </span>
      <Textarea
        value={content}
        onChange={handleChange}
        className="w-full h-full resize-none"
        placeholder={`Enter content for ${title}`}
      />
    </div>
  );
};

export default HalfWidthBox;
