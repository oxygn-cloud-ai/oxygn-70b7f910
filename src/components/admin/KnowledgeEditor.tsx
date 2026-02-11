import { useState } from 'react';
import { 
  Save, X, Tag, ChevronDown, Loader2, Eye, EyeOff
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingCard } from '@/components/ui/setting-card';
import { SettingRow } from '@/components/ui/setting-row';
import { SettingDivider } from '@/components/ui/setting-divider';
import ReactMarkdown from 'react-markdown';
import { ResizablePromptArea } from '@/components/shared';

interface KnowledgeItem {
  row_id?: string;
  topic?: string;
  title?: string;
  content?: string;
  keywords?: string[];
  priority?: number;
}

interface KnowledgeEditorProps {
  item: KnowledgeItem | null;
  topics: string[];
  onSave: (data: { topic: string; title: string; content: string; keywords: string[]; priority: number }) => Promise<void>;
  onCancel: () => void;
}

const KnowledgeEditor = ({ item, topics, onSave, onCancel }: KnowledgeEditorProps) => {
  const [formData, setFormData] = useState({
    topic: item?.topic || 'overview',
    title: item?.title || '',
    content: item?.content || '',
    keywords: item?.keywords || [] as string[],
    priority: item?.priority || 0
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;
    setIsSaving(true);
    try { await onSave(formData); } finally { setIsSaving(false); }
  };

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !formData.keywords.includes(kw)) {
      setFormData(prev => ({ ...prev, keywords: [...prev.keywords, kw] }));
      setKeywordInput('');
    }
  };

  const removeKeyword = (kw: string) => {
    setFormData(prev => ({ ...prev, keywords: prev.keywords.filter((k: string) => k !== kw) }));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addKeyword(); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-title-sm text-on-surface font-medium">
          {item ? 'Edit Knowledge' : 'New Knowledge Item'}
        </h3>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => setShowPreview(!showPreview)} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container">
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">{showPreview ? 'Hide Preview' : 'Show Preview'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container">
                <X className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Cancel</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="submit" disabled={isSaving || !formData.title.trim() || !formData.content.trim()} className="w-8 h-8 flex items-center justify-center rounded-m3-full bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Save</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <SettingCard label="Metadata">
        <div className="space-y-3">
          <SettingRow label="Topic" description="Category for this knowledge">
            <div className="relative">
              <button type="button" onClick={() => setShowTopicDropdown(!showTopicDropdown)} className="h-8 px-3 flex items-center gap-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface">
                {formData.topic.replace('_', ' ')}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showTopicDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-surface-container-high rounded-m3-md shadow-lg border border-outline-variant z-10 py-1 max-h-48 overflow-auto">
                  {topics.map((topic: string) => (
                    <button key={topic} type="button" onClick={() => { setFormData(prev => ({ ...prev, topic })); setShowTopicDropdown(false); }}
                      className={`w-full px-3 py-1.5 text-left text-body-sm hover:bg-surface-container ${formData.topic === topic ? 'text-primary' : 'text-on-surface'}`}>
                      {topic.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </SettingRow>
          <SettingDivider />
          <SettingRow label="Priority" description="Higher priority items appear first (0-10)">
            <input type="number" min="0" max="10" value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
              className="h-8 w-16 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface text-center focus:outline-none focus:ring-1 focus:ring-primary" />
          </SettingRow>
        </div>
      </SettingCard>

      <SettingCard label="Title">
        <input type="text" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter a clear, descriptive title..."
          className="w-full h-9 px-3 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary" />
      </SettingCard>

      <SettingCard label="Keywords">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input type="text" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} onKeyDown={handleKeywordKeyDown}
              placeholder="Add keyword..."
              className="flex-1 h-8 px-3 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary" />
            <button type="button" onClick={addKeyword} className="h-8 px-3 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface-variant hover:bg-surface-container-high">Add</button>
          </div>
          {formData.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {formData.keywords.map((kw: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container rounded-full text-[10px] text-on-surface-variant">
                  <Tag className="h-2.5 w-2.5" />{kw}
                  <button type="button" onClick={() => removeKeyword(kw)} className="ml-0.5 hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </SettingCard>

      <SettingCard label="Content (Markdown)">
        {showPreview ? (
          <div className="min-h-[200px] p-3 bg-surface-container rounded-m3-sm border border-outline-variant prose prose-sm max-w-none text-on-surface">
            <ReactMarkdown>{formData.content || '*No content*'}</ReactMarkdown>
          </div>
        ) : (
          <ResizablePromptArea label="Content" value={formData.content} placeholder="Write knowledge content in Markdown format..."
            defaultHeight={240} onSave={(value) => setFormData(prev => ({ ...prev, content: value }))} storageKey={`knowledge-${item?.row_id || 'new'}-content`} />
        )}
      </SettingCard>
    </form>
  );
};

export default KnowledgeEditor;
