import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TextHighlighter = ({ text, highlights, onHighlight, sourceInfo, onSourceInfoChange }) => {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const handleMouseUp = () => {
    const selectionObj = window.getSelection();
    const range = selectionObj.getRangeAt(0);
    const start = range.startOffset;
    const end = range.endOffset;
    setSelection({ start, end });
  };

  const handleHighlight = () => {
    const newHighlight = {
      start: selection.start,
      end: selection.end,
      text: text.slice(selection.start, selection.end),
    };
    onHighlight([...highlights, newHighlight]);
  };

  const handleSourceInfoSubmit = (e) => {
    e.preventDefault();
    const newSourceInfo = {
      ...sourceInfo,
      title: sourceTitle,
      url: sourceUrl,
    };
    onSourceInfoChange(newSourceInfo);
    setSourceTitle('');
    setSourceUrl('');
  };

  const renderHighlightedText = () => {
    let result = [];
    let lastIndex = 0;
    highlights.forEach((highlight, index) => {
      result.push(text.slice(lastIndex, highlight.start));
      result.push(
        <span key={index} className="bg-yellow-200">
          {text.slice(highlight.start, highlight.end)}
        </span>
      );
      lastIndex = highlight.end;
    });
    result.push(text.slice(lastIndex));
    return result;
  };

  return (
    <div className="space-y-4">
      <div onMouseUp={handleMouseUp} className="p-4 border rounded">
        {renderHighlightedText()}
      </div>
      <Button onClick={handleHighlight}>Highlight Selection</Button>
      <form onSubmit={handleSourceInfoSubmit} className="space-y-2">
        <div>
          <Label htmlFor="sourceTitle">Source Title</Label>
          <Input
            id="sourceTitle"
            value={sourceTitle}
            onChange={(e) => setSourceTitle(e.target.value)}
            placeholder="Enter source title"
          />
        </div>
        <div>
          <Label htmlFor="sourceUrl">Source URL</Label>
          <Input
            id="sourceUrl"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Enter source URL"
          />
        </div>
        <Button type="submit">Add Source Info</Button>
      </form>
      <div>
        <h4 className="font-semibold">Source Information:</h4>
        <p>Title: {sourceInfo.title || 'Not set'}</p>
        <p>URL: {sourceInfo.url || 'Not set'}</p>
      </div>
    </div>
  );
};

export default TextHighlighter;