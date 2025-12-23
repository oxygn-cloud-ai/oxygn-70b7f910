import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Upload, Loader2, FileStack, ListChecks, Send, Settings2, Check } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ExportPromptSelector } from './ExportPromptSelector';
import { ExportFieldSelector } from './ExportFieldSelector';
import { ExportTypeSelector } from './ExportTypeSelector';
import { ConfluenceConfig } from './types/confluence/ConfluenceConfig';

const STEPS = [
  { key: 1, label: 'Select Prompts', icon: FileStack },
  { key: 2, label: 'Select Fields', icon: ListChecks },
  { key: 3, label: 'Destination', icon: Send },
  { key: 4, label: 'Configure', icon: Settings2 },
];

export const ExportDrawer = ({
  isOpen,
  onClose,
  currentStep,
  selectedPromptIds,
  selectedFields,
  selectedVariables,
  exportType,
  promptsData,
  variablesData,
  treeData,
  isLoadingPrompts,
  isLoadingVariables,
  canProceed,
  onGoBack,
  onGoNext,
  onTogglePrompt,
  onToggleWithDescendants,
  onSelectAllPrompts,
  onClearPrompts,
  onToggleField,
  onToggleVariable,
  onSetExportType,
  onFetchPrompts,
  onFetchVariables,
  getExportData,
  EXPORT_STEPS,
  EXPORT_TYPES,
  STANDARD_FIELDS,
  confluenceExport
}) => {
  // When moving to step 2, fetch prompt data and variables
  useEffect(() => {
    if (currentStep === EXPORT_STEPS.SELECT_FIELDS && selectedPromptIds.length > 0) {
      onFetchPrompts(selectedPromptIds);
      onFetchVariables(selectedPromptIds);
    }
  }, [currentStep, selectedPromptIds, onFetchPrompts, onFetchVariables, EXPORT_STEPS.SELECT_FIELDS]);

  // When moving to step 4 (Confluence config), initialize
  useEffect(() => {
    if (currentStep === EXPORT_STEPS.CONFIGURE && exportType === EXPORT_TYPES.CONFLUENCE) {
      confluenceExport.initialize();
    }
  }, [currentStep, exportType, confluenceExport, EXPORT_STEPS.CONFIGURE, EXPORT_TYPES.CONFLUENCE]);

  const handleExport = async () => {
    if (exportType === EXPORT_TYPES.CONFLUENCE) {
      try {
        const exportData = getExportData;
        console.log('[ExportDrawer] Export data:', exportData);
        console.log('[ExportDrawer] Page title:', confluenceExport.pageTitle);
        console.log('[ExportDrawer] Space key:', confluenceExport.selectedSpaceKey);
        console.log('[ExportDrawer] Parent ID:', confluenceExport.selectedParentId);
        
        if (!exportData || exportData.length === 0) {
          console.error('[ExportDrawer] No export data available');
          return;
        }
        
        const result = await confluenceExport.exportToConfluence(
          exportData,
          confluenceExport.pageTitle || 'Exported Prompts'
        );
        if (result?.page?.url) {
          window.open(result.page.url, '_blank');
        }
        onClose();
      } catch (error) {
        console.error('[ExportDrawer] Export failed:', error);
        console.error('[ExportDrawer] Error message:', error.message);
      }
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case EXPORT_STEPS.SELECT_PROMPTS:
        return (
          <ExportPromptSelector
            treeData={treeData}
            selectedPromptIds={selectedPromptIds}
            onTogglePrompt={onTogglePrompt}
            onToggleWithDescendants={onToggleWithDescendants}
            onSelectAll={onSelectAllPrompts}
            onClearSelection={onClearPrompts}
          />
        );
      
      case EXPORT_STEPS.SELECT_FIELDS:
        return (
          <ExportFieldSelector
            promptsData={promptsData}
            variablesData={variablesData}
            selectedFields={selectedFields}
            selectedVariables={selectedVariables}
            isLoadingPrompts={isLoadingPrompts}
            isLoadingVariables={isLoadingVariables}
            onToggleField={onToggleField}
            onToggleVariable={onToggleVariable}
            STANDARD_FIELDS={STANDARD_FIELDS}
          />
        );
      
      case EXPORT_STEPS.SELECT_TYPE:
        return (
          <ExportTypeSelector
            selectedType={exportType}
            onSelectType={onSetExportType}
            EXPORT_TYPES={EXPORT_TYPES}
          />
        );
      
      case EXPORT_STEPS.CONFIGURE:
        if (exportType === EXPORT_TYPES.CONFLUENCE) {
          return (
            <ConfluenceConfig
              spaces={confluenceExport.spaces}
              templates={confluenceExport.templates}
              spaceTree={confluenceExport.spaceTree}
              selectedSpaceKey={confluenceExport.selectedSpaceKey}
              selectedParentId={confluenceExport.selectedParentId}
              selectedTemplate={confluenceExport.selectedTemplate}
              templateMappings={confluenceExport.templateMappings}
              pageTitle={confluenceExport.pageTitle}
              useBlankPage={confluenceExport.useBlankPage}
              isLoadingTree={confluenceExport.isLoadingTree}
              isLoadingTemplates={confluenceExport.isLoadingTemplates}
              promptsData={promptsData}
              variablesData={variablesData}
              selectedFields={selectedFields}
              selectedVariables={selectedVariables}
              onSelectSpace={confluenceExport.selectSpace}
              onSelectParent={confluenceExport.selectParent}
              onSelectTemplate={confluenceExport.selectTemplate}
              onChooseBlankPage={confluenceExport.chooseBlankPage}
              onUpdateMapping={confluenceExport.updateMapping}
              onSetPageTitle={confluenceExport.setPageTitle}
              STANDARD_FIELDS={STANDARD_FIELDS}
            />
          );
        }
        return <div className="text-center text-muted-foreground py-8">Coming soon</div>;
      
      default:
        return null;
    }
  };

  const isLastStep = currentStep === EXPORT_STEPS.CONFIGURE;
  const isExporting = confluenceExport?.isCreatingPage;

  // Calculate summary text
  const getSummaryText = () => {
    const parts = [];
    parts.push(`${selectedPromptIds.length} prompt${selectedPromptIds.length !== 1 ? 's' : ''}`);
    if (currentStep >= 2) {
      parts.push(`${selectedFields.length} field${selectedFields.length !== 1 ? 's' : ''}`);
      const varCount = Object.values(selectedVariables).flat().length;
      if (varCount > 0) {
        parts.push(`${varCount} var${varCount !== 1 ? 's' : ''}`);
      }
    }
    return parts.join(' · ');
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right"
        hideCloseButton
        className="w-full sm:max-w-[580px] p-0 flex flex-col gap-0 border-l border-border/50 shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 space-y-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-semibold font-poppins">Export Prompts</SheetTitle>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Step Navigation Tabs */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.key;
              const isCompleted = currentStep > step.key;
              const isClickable = step.key < currentStep;
              
              return (
                <button
                  key={step.key}
                  onClick={() => isClickable && onGoBack()}
                  disabled={!isClickable && !isActive}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-all",
                    isActive && "bg-background shadow-sm text-foreground",
                    isCompleted && "text-primary hover:bg-background/50 cursor-pointer",
                    !isActive && !isCompleted && "text-muted-foreground cursor-default"
                  )}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-primary/20 text-primary",
                    !isActive && !isCompleted && "bg-muted-foreground/20 text-muted-foreground"
                  )}>
                    {isCompleted ? <Check className="h-3 w-3" /> : step.key}
                  </div>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              );
            })}
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-6">
          {renderStepContent()}
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onGoBack}
              disabled={currentStep === EXPORT_STEPS.SELECT_PROMPTS}
              className={cn(
                "gap-1.5",
                currentStep === EXPORT_STEPS.SELECT_PROMPTS && "invisible"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {getSummaryText()}
              </span>
              
              {isLastStep ? (
                <Button
                  size="sm"
                  onClick={handleExport}
                  disabled={!canProceed || isExporting || !confluenceExport.pageTitle || !confluenceExport.selectedSpaceKey}
                  className="gap-1.5 min-w-[100px]"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Export
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onGoNext}
                  disabled={!canProceed}
                  className="gap-1.5 min-w-[100px]"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
