/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, type ReactNode } from 'react';
import { Download, Copy, Check, AlertCircle, FileJson } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';

const VALID_TOPICS = [
  'overview', 'prompts', 'variables', 'templates', 'json_schemas',
  'actions', 'files', 'confluence', 'cascade', 'library',
  'troubleshooting', 'database', 'edge_functions', 'api'
];

interface KnowledgeExportItem {
  topic: string;
  title: string;
  content: string;
  keywords?: string[];
  priority?: number;
}

interface ExportDialogProps {
  items: KnowledgeExportItem[];
  selectedTopic: string | null;
  trigger: ReactNode;
}

export const ExportKnowledgeDialog = ({ items, selectedTopic, trigger }: ExportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const exportData = {
    _exportVersion: 1,
    exported_at: new Date().toISOString(),
    topic_filter: selectedTopic || null,
    item_count: items.length,
    items: items.map(({ topic, title, content, keywords, priority }) => ({
      topic, title, content, keywords: keywords || [], priority: priority || 0
    }))
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge-export-${selectedTopic || 'all'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('JSON file downloaded');
    setOpen(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-surface-container-low">
        <DialogHeader>
          <DialogTitle className="text-title-sm text-on-surface">Export Knowledge Items</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between text-body-sm text-on-surface-variant mb-2">
          <span>{items.length} item{items.length !== 1 ? 's' : ''}{selectedTopic && ` in "${selectedTopic.replace('_', ' ')}"`}</span>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="h-7 px-2.5 flex items-center gap-1.5 rounded-m3-sm bg-surface-container text-on-surface-variant hover:bg-surface-container-high text-[11px]">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={handleDownload} className="h-7 px-2.5 flex items-center gap-1.5 rounded-m3-sm bg-primary text-on-primary hover:bg-primary/90 text-[11px]">
              <Download className="h-3 w-3" />Download JSON
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-surface-container rounded-m3-md p-3 font-mono text-[11px] text-on-surface-variant">
          <pre className="whitespace-pre-wrap break-words">{jsonString}</pre>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface ParseResult {
  valid: boolean;
  error?: string;
  items?: KnowledgeExportItem[];
  totalCount?: number;
  validCount?: number;
  errorCount?: number;
  errors?: string[];
  hasMoreErrors?: boolean;
}

interface ImportDialogProps {
  topics: string[];
  onImport: (items: KnowledgeExportItem[]) => Promise<{ created: number; updated: number; errors?: string[] }>;
  trigger: ReactNode;
}

export const ImportKnowledgeDialog = ({ topics: _topics, onImport, trigger }: ImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => { setJsonInput(''); setParseResult(null); setIsImporting(false); setProgress({ current: 0, total: 0 }); };

  const validateAndParse = (input: string): ParseResult => {
    try {
      const data = JSON.parse(input);
      if (!data.items || !Array.isArray(data.items)) return { valid: false, error: 'JSON must contain an "items" array' };

      const errors: string[] = [];
      const validItems: KnowledgeExportItem[] = [];

      data.items.forEach((item: any, index: number) => {
        const itemErrors: string[] = [];
        if (!item.topic) itemErrors.push('missing topic');
        else if (!VALID_TOPICS.includes(item.topic)) itemErrors.push(`invalid topic "${item.topic}"`);
        if (!item.title) itemErrors.push('missing title');
        if (!item.content) itemErrors.push('missing content');
        if (itemErrors.length > 0) {
          errors.push(`Item ${index + 1} (${item.title || 'untitled'}): ${itemErrors.join(', ')}`);
        } else {
          validItems.push({ topic: item.topic, title: item.title, content: item.content, keywords: item.keywords || [], priority: item.priority || 0 });
        }
      });

      return { valid: validItems.length > 0, items: validItems, totalCount: data.items.length, validCount: validItems.length, errorCount: errors.length, errors: errors.slice(0, 5), hasMoreErrors: errors.length > 5 };
    } catch (e: any) {
      return { valid: false, error: `Invalid JSON: ${e.message}` };
    }
  };

  const handleInputChange = (value: string) => {
    setJsonInput(value);
    setParseResult(value.trim() ? validateAndParse(value) : null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { const content = event.target?.result; if (typeof content === 'string') handleInputChange(content); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!parseResult?.valid || !parseResult.items) return;
    setIsImporting(true);
    setProgress({ current: 0, total: parseResult.items.length });
    try {
      const results = await onImport(parseResult.items);
      if (results.errors?.length) toast.error(`Import completed with ${results.errors.length} error(s)`);
      else toast.success(`Imported: ${results.created} created, ${results.updated} updated`);
      setOpen(false); resetState();
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally { setIsImporting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-surface-container-low">
        <DialogHeader>
          <DialogTitle className="text-title-sm text-on-surface">Import Knowledge Items</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 mb-2">
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="h-8 px-3 flex items-center gap-2 rounded-m3-sm bg-surface-container text-on-surface-variant hover:bg-surface-container-high text-body-sm">
            <FileJson className="h-4 w-4" />Upload JSON File
          </button>
          <span className="text-[10px] text-on-surface-variant">or paste below</span>
        </div>
        <textarea value={jsonInput} onChange={(e) => handleInputChange(e.target.value)}
          placeholder='{"items": [{"topic": "prompts", "title": "...", "content": "..."}]}'
          className="flex-1 min-h-[200px] p-3 bg-surface-container rounded-m3-md border border-outline-variant text-[11px] font-mono text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        {parseResult && (
          <div className={`p-3 rounded-m3-md ${parseResult.valid ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            {parseResult.error ? (
              <div className="flex items-start gap-2 text-red-500 text-body-sm"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{parseResult.error}</span></div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-body-sm">
                  {parseResult.valid ? <Check className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                  <span className="text-on-surface"><strong>{parseResult.validCount}</strong> valid of {parseResult.totalCount} items
                    {(parseResult.errorCount ?? 0) > 0 && <span className="text-red-500"> ({parseResult.errorCount} with errors)</span>}
                  </span>
                </div>
                {(parseResult.errors?.length ?? 0) > 0 && (
                  <div className="text-[10px] text-red-500 space-y-0.5 ml-6">
                    {parseResult.errors!.map((err: string, i: number) => <div key={i}>• {err}</div>)}
                    {parseResult.hasMoreErrors && <div>• ... and {(parseResult.errorCount ?? 0) - 5} more errors</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {isImporting && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-on-surface-variant"><span>Importing...</span><span>{progress.current} / {progress.total}</span></div>
            <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={() => { setOpen(false); resetState(); }} className="h-8 px-4 rounded-m3-sm text-body-sm text-on-surface-variant hover:bg-surface-container">Cancel</button>
          <button onClick={handleImport} disabled={!parseResult?.valid || isImporting}
            className="h-8 px-4 rounded-m3-sm bg-primary text-on-primary text-body-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
            {isImporting ? 'Importing...' : `Import ${parseResult?.validCount || 0} Items`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
