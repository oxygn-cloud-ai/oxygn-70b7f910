// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Save, FolderOpen, Trash2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useExportTemplates } from '@/hooks/useExportTemplates';
import { trackEvent } from '@/lib/posthog';

export const ExportTemplatePicker = ({
  exportType,
  currentConfig,
  onLoadTemplate,
  className
}) => {
  const {
    templates,
    isLoading,
    isSaving,
    fetchTemplates,
    saveTemplate,
    deleteTemplate
  } = useExportTemplates();

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const hasFetchedRef = useRef(false);

  // Fetch templates when dialog opens (only once per open)
  useEffect(() => {
    if (showLoadDialog && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchTemplates(exportType);
    }
    if (!showLoadDialog) {
      hasFetchedRef.current = false;
    }
  }, [showLoadDialog, exportType]);

  const handleSave = async () => {
    if (!newTemplateName.trim()) return;

    try {
      await saveTemplate({
        templateName: newTemplateName.trim(),
        exportType,
        selectedFields: currentConfig.selectedFields,
        selectedVariables: currentConfig.selectedVariables,
        confluenceConfig: currentConfig.confluenceConfig || {}
      });
      setShowSaveDialog(false);
      setNewTemplateName('');
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleLoad = () => {
    const template = templates.find(t => t.row_id === selectedTemplateId);
    if (template) {
      onLoadTemplate({
        selectedFields: template.selected_fields || [],
        selectedVariables: template.selected_variables || {},
        confluenceConfig: template.confluence_config || {}
      });
      trackEvent('export_template_loaded', { template_id: selectedTemplateId });
      setShowLoadDialog(false);
      setSelectedTemplateId('');
    }
  };

  const handleDeleteClick = (template, e) => {
    e.stopPropagation();
    setTemplateToDelete(template);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      await deleteTemplate(templateToDelete.row_id);
      if (selectedTemplateId === templateToDelete.row_id) {
        setSelectedTemplateId('');
      }
    }
    setShowDeleteConfirm(false);
    setTemplateToDelete(null);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Save Template Button */}
      <button
        onClick={() => setShowSaveDialog(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/50 hover:bg-muted transition-colors"
        title="Save as template"
      >
        <Save className="h-3.5 w-3.5" />
        Save
      </button>

      {/* Load Template Button */}
      <button
        onClick={() => setShowLoadDialog(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/50 hover:bg-muted transition-colors"
        title="Load template"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        Load
      </button>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Export Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Enter template name..."
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will save your current field selections and variable mappings for reuse.
            </p>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 text-sm rounded-lg border border-border/50 hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!newTemplateName.trim() || isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save Template
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Load Export Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No saved templates found
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Template</Label>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {templates.map(template => (
                    <div
                      key={template.row_id}
                      onClick={() => setSelectedTemplateId(template.row_id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedTemplateId === template.row_id
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:bg-muted/50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{template.template_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {template.selected_fields?.length || 0} fields • 
                          {Object.keys(template.selected_variables || {}).reduce((sum, key) => 
                            sum + (template.selected_variables[key]?.length || 0), 0
                          )} variables
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteClick(template, e)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowLoadDialog(false)}
              className="px-4 py-2 text-sm rounded-lg border border-border/50 hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLoad}
              disabled={!selectedTemplateId}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <FolderOpen className="h-4 w-4" />
              Load Template
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.template_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
