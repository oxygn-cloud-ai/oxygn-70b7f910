import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Upload, Loader2 } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ExportPromptSelector } from './ExportPromptSelector';
import { ExportFieldSelector } from './ExportFieldSelector';
import { ExportTypeSelector } from './ExportTypeSelector';
import { ConfluenceConfig } from './types/confluence/ConfluenceConfig';

const STEP_LABELS = {
  1: 'Select Prompts',
  2: 'Select Fields',
  3: 'Export Type',
  4: 'Configure'
};

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
        const result = await confluenceExport.exportToConfluence(
          exportData,
          confluenceExport.pageTitle || 'Exported Prompts'
        );
        if (result?.page?.url) {
          window.open(result.page.url, '_blank');
        }
        onClose();
      } catch (error) {
        console.error('Export failed:', error);
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

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[85vh] max-h-[85vh]">
        <DrawerHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-semibold">Export Prompts</DrawerTitle>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {Object.entries(STEP_LABELS).map(([step, label]) => {
              const stepNum = parseInt(step);
              const isActive = currentStep === stepNum;
              const isCompleted = currentStep > stepNum;
              
              return (
                <React.Fragment key={step}>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                        isActive && "bg-primary text-primary-foreground",
                        isCompleted && "bg-primary/20 text-primary",
                        !isActive && !isCompleted && "bg-muted text-muted-foreground"
                      )}
                    >
                      {stepNum}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium hidden sm:inline",
                        isActive && "text-foreground",
                        !isActive && "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  {stepNum < 4 && (
                    <div className={cn(
                      "h-px w-8 transition-colors",
                      isCompleted ? "bg-primary" : "bg-border"
                    )} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {renderStepContent()}
        </ScrollArea>

        <DrawerFooter className="border-t border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onGoBack}
              disabled={currentStep === EXPORT_STEPS.SELECT_PROMPTS}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                currentStep === EXPORT_STEPS.SELECT_PROMPTS
                  ? "text-muted-foreground cursor-not-allowed"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {selectedPromptIds.length} prompt{selectedPromptIds.length !== 1 ? 's' : ''} selected
              </span>
              
              {isLastStep ? (
                <button
                  onClick={handleExport}
                  disabled={!canProceed || isExporting || !confluenceExport.pageTitle || !confluenceExport.selectedSpaceKey}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    canProceed && confluenceExport.pageTitle && confluenceExport.selectedSpaceKey && !isExporting
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
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
                </button>
              ) : (
                <button
                  onClick={onGoNext}
                  disabled={!canProceed}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    canProceed
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
