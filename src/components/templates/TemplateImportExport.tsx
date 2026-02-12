// @ts-nocheck
import React, { useRef, useState } from 'react';
import { Download, Upload, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';

/**
 * Export a template as JSON
 */
export const ExportTemplateDialog = ({ template, trigger }) => {
  const [copied, setCopied] = useState(false);
  
  const exportData = {
    _exportVersion: 1,
    template_name: template.template_name,
    template_description: template.template_description,
    category: template.category,
    structure: template.structure,
    variable_definitions: template.variable_definitions || [],
    exported_at: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-${template.template_name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template exported');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="!text-muted-foreground hover:!text-foreground hover:!bg-muted/50">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Template</DialogTitle>
          <DialogDescription>
            Download or copy the template as JSON to share or backup.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Textarea
              value={jsonString}
              readOnly
              className="font-mono text-xs h-80"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCopy} className="!text-muted-foreground hover:!text-foreground hover:!bg-muted/50">
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="ghost" onClick={handleDownload} className="!text-primary hover:!bg-muted/50">
            <Download className="h-4 w-4 mr-2" />
            Download JSON
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Import a template from JSON
 */
export const ImportTemplateDialog = ({ onImport, trigger }) => {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonInput(event.target.result);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setError(null);
    setIsImporting(true);

    try {
      const data = JSON.parse(jsonInput);

      // Validate structure
      if (!data.template_name) {
        throw new Error('Invalid template: missing template_name');
      }
      if (!data.structure) {
        throw new Error('Invalid template: missing structure');
      }

      // Call the import handler
      await onImport({
        name: data.template_name,
        description: data.template_description || '',
        category: data.category || 'general',
        structure: data.structure,
        variableDefinitions: data.variable_definitions || [],
      });

      setOpen(false);
      setJsonInput('');
      toast.success('Template imported');
    } catch (err) {
      console.error('Import error:', err);
      const errorMsg = err.message || 'Invalid JSON format';
      setError(errorMsg);
      toast.error('Import failed', { description: errorMsg });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="!text-muted-foreground hover:!text-foreground hover:!bg-muted/50">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Template</DialogTitle>
          <DialogDescription>
            Import a template from a JSON file or paste JSON directly.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Upload JSON File</Label>
            <div className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
          </div>

          <div className="relative">
            <Label>Or Paste JSON</Label>
            <Textarea
              value={jsonInput}
              onChange={(e) => { setJsonInput(e.target.value); setError(null); }}
              placeholder='{"template_name": "...", "structure": {...}}'
              className="font-mono text-xs h-60 mt-2"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={!jsonInput.trim() || isImporting}>
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default { ExportTemplateDialog, ImportTemplateDialog };
