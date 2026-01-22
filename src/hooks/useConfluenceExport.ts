import { useState, useCallback } from 'react';
import { useConfluencePages } from './useConfluencePages';
import { applyTemplateVariables } from '@/utils/resolveSystemVariables';
import { trackEvent, trackException } from '@/lib/posthog';
import { toast } from '@/components/ui/sonner';

const DEFAULT_PAGE_TITLE = 'A New Qonsol Generated Page';

// ============================================================================
// Types
// ============================================================================

export interface TemplateMapping {
  type: 'static' | 'source' | 'field' | 'variable';
  value?: string;
  source?: VariableSource;
  promptId?: string;
  fieldId?: string;
  variableName?: string;
}

export interface TemplateMappings {
  [variableName: string]: TemplateMapping;
}

export interface VariableSource {
  promptId: string;
  sourceType: 'field' | 'variable';
  sourceId: string;
}

export interface ConfluenceTemplate {
  id: string;
  name: string;
  body?: string;
  variables?: string[];
  [key: string]: unknown;
}

export interface ExportDataItem {
  row_id: string;
  prompt_name?: string;
  output_response?: string;
  user_prompt_result?: string;
  input_user_prompt?: string;
  input_admin_prompt?: string;
  note?: string;
  system_variables?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreatePageResult {
  success: boolean;
  pageId?: string;
  pageUrl?: string;
  error?: string;
  [key: string]: unknown;
}

export interface UseConfluenceExportReturn {
  // State
  spaces: unknown[];
  templates: ConfluenceTemplate[];
  spaceTree: unknown[];
  selectedSpaceKey: string | null;
  selectedParentId: string | null;
  selectedTemplate: ConfluenceTemplate | null;
  templateMappings: TemplateMappings;
  pageTitle: string;
  useBlankPage: boolean;
  pageTitleSource: VariableSource | null;
  isLoadingTree: boolean;
  isLoadingTemplates: boolean;
  isCreatingPage: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  selectSpace: (spaceKey: string | null) => Promise<void>;
  selectParent: (parentId: string | null) => void;
  selectTemplate: (template: ConfluenceTemplate | null) => void;
  chooseBlankPage: () => void;
  updateMapping: (variableName: string, mapping: TemplateMapping) => void;
  setPageTitle: React.Dispatch<React.SetStateAction<string>>;
  setPageTitleSource: React.Dispatch<React.SetStateAction<VariableSource | null>>;
  exportToConfluence: (exportData: ExportDataItem[]) => Promise<CreatePageResult>;
  reset: () => void;
  getPageChildren: (nodeId: string, spaceKey: string, nodeType?: string) => Promise<unknown[]>;
  setSpaceTree: React.Dispatch<React.SetStateAction<unknown[]>>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape HTML special characters
 */
function escapeHtml(text: unknown): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br/>');
}

// ============================================================================
// Hook Implementation
// ============================================================================

export const useConfluenceExport = (): UseConfluenceExportReturn => {
  const {
    spaces,
    templates,
    spaceTree,
    isLoadingTree,
    isLoadingTemplates,
    isCreatingPage,
    listSpaces,
    listTemplates,
    getSpaceTree,
    getPageChildren,
    createPage,
    findUniqueTitle,
    clearSpaceTree,
    clearTemplates,
    setSpaceTree
  } = useConfluencePages();

  const [selectedSpaceKey, setSelectedSpaceKey] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ConfluenceTemplate | null>(null);
  const [templateMappings, setTemplateMappings] = useState<TemplateMappings>({});
  const [pageTitle, setPageTitle] = useState<string>('');
  const [useBlankPage, setUseBlankPage] = useState<boolean>(true);
  
  // Page title can be dynamic from a variable source
  // { promptId, sourceType: 'field' | 'variable', sourceId } or null for static
  const [pageTitleSource, setPageTitleSource] = useState<VariableSource | null>(null);

  // Initialize - load spaces
  const initialize = useCallback(async (): Promise<void> => {
    await listSpaces();
  }, [listSpaces]);

  // Select a space - load its tree and templates
  const selectSpace = useCallback(async (spaceKey: string | null): Promise<void> => {
    setSelectedSpaceKey(spaceKey);
    setSelectedParentId(null);
    setSelectedTemplate(null);
    setTemplateMappings({});
    
    if (spaceKey) {
      await Promise.all([
        getSpaceTree(spaceKey),
        listTemplates(spaceKey)
      ]);
    } else {
      clearSpaceTree();
      clearTemplates();
    }
  }, [getSpaceTree, listTemplates, clearSpaceTree, clearTemplates]);

  // Select parent page/folder - stores the page ID for Confluence API
  const selectParent = useCallback((parentId: string | null): void => {
    console.log('[useConfluenceExport] selectParent called with:', parentId);
    setSelectedParentId(parentId);
  }, []);

  // Select a template
  const selectTemplate = useCallback((template: ConfluenceTemplate | null): void => {
    setSelectedTemplate(template);
    setUseBlankPage(false);
    // Initialize mappings for template variables
    if (template?.variables) {
      const initialMappings: TemplateMappings = {};
      template.variables.forEach(varName => {
        initialMappings[varName] = { type: 'static', value: '' };
      });
      setTemplateMappings(initialMappings);
    }
  }, []);

  // Use blank page instead of template
  const chooseBlankPage = useCallback((): void => {
    setUseBlankPage(true);
    setSelectedTemplate(null);
    setTemplateMappings({});
  }, []);

  // Update a template variable mapping
  const updateMapping = useCallback((variableName: string, mapping: TemplateMapping): void => {
    setTemplateMappings(prev => ({
      ...prev,
      [variableName]: mapping
    }));
  }, []);

  // Resolve a value from export data based on source
  const resolveSourceValue = useCallback((source: VariableSource | null, exportData: ExportDataItem[]): string => {
    if (!source || !exportData || exportData.length === 0) return '';
    
    // Find the prompt data
    const promptData = exportData.find(p => p.row_id === source.promptId);
    if (!promptData) {
      // Fallback to first prompt if not found
      const firstPrompt = exportData[0];
      if (source.sourceType === 'field') {
        return String(firstPrompt[source.sourceId] || '');
      } else if (source.sourceType === 'variable') {
        return String(firstPrompt[`var_${source.sourceId}`] || '');
      }
      return '';
    }
    
    if (source.sourceType === 'field') {
      return String(promptData[source.sourceId] || '');
    } else if (source.sourceType === 'variable') {
      return String(promptData[`var_${source.sourceId}`] || '');
    }
    
    return '';
  }, []);

  // Helper to resolve {{variable}} placeholders in content, including q.ref[UUID] patterns
  const resolveContentVariables = useCallback((
    content: string | null | undefined,
    exportItem: ExportDataItem,
    allExportData: ExportDataItem[] = []
  ): string => {
    if (!content) return '';
    
    // Build variables map from var_* prefixed keys
    const varMap: Record<string, string> = {};
    Object.keys(exportItem).forEach(key => {
      if (key.startsWith('var_')) {
        const varName = key.replace('var_', '');
        varMap[varName] = String(exportItem[key] || '');
      }
    });
    
    // Resolve q.ref[UUID].field patterns
    const refPattern = /\{\{q\.ref\[([a-f0-9-]{36})\]\.([a-z_]+)\}\}/gi;
    let resolved = content.replace(refPattern, (match, uuid, field) => {
      // Find the referenced prompt in export data
      const refPrompt = allExportData.find(p => p.row_id === uuid.toLowerCase());
      if (!refPrompt) return match; // Leave unresolved if not found
      
      // Get the field value
      if (field === 'output_response') return refPrompt.output_response || '';
      if (field === 'user_prompt_result') return refPrompt.user_prompt_result || refPrompt.output_response || '';
      if (field === 'input_admin_prompt') return refPrompt.input_admin_prompt || '';
      if (field === 'input_user_prompt') return refPrompt.input_user_prompt || '';
      if (field === 'prompt_name') return refPrompt.prompt_name || '';
      
      // Check system_variables
      if (refPrompt.system_variables && refPrompt.system_variables[field]) {
        return String(refPrompt.system_variables[field]);
      }
      
      return match; // Leave unresolved if field not found
    });
    
    // Apply regular variable substitution
    return applyTemplateVariables(resolved, varMap);
  }, []);

  // Build the page body from template and mappings
  const buildPageBody = useCallback((exportData: ExportDataItem[]): string => {
    if (useBlankPage || !selectedTemplate) {
      // Build a simple page from export data
      let body = '<h1>Exported Content</h1>';
      
      exportData.forEach(item => {
        body += `<h2>${item.prompt_name || 'Untitled Prompt'}</h2>`;
        
        // Use output_response (already normalized to include user_prompt_result)
        // Apply variable resolution BEFORE escaping HTML, pass all export data for q.ref resolution
        if (item.output_response) {
          const resolved = resolveContentVariables(item.output_response, item, exportData);
          body += `<h3>Output</h3><p>${escapeHtml(resolved)}</p>`;
        }
        if (item.input_user_prompt) {
          const resolved = resolveContentVariables(item.input_user_prompt, item, exportData);
          body += `<h3>User Prompt</h3><p>${escapeHtml(resolved)}</p>`;
        }
        if (item.input_admin_prompt) {
          const resolved = resolveContentVariables(item.input_admin_prompt, item, exportData);
          body += `<h3>System Prompt</h3><p>${escapeHtml(resolved)}</p>`;
        }
        if (item.note) {
          const resolved = resolveContentVariables(item.note, item, exportData);
          body += `<h3>Notes</h3><p>${escapeHtml(resolved)}</p>`;
        }
        
        // Add variables (values are already resolved, no placeholders expected)
        Object.keys(item).forEach(key => {
          if (key.startsWith('var_')) {
            const varName = key.replace('var_', '');
            body += `<p><strong>${varName}:</strong> ${escapeHtml(item[key])}</p>`;
          }
        });
      });
      
      return body;
    }

    // Build from template with mappings
    let body = selectedTemplate.body || '';
    
    Object.entries(templateMappings).forEach(([varName, mapping]) => {
      let value = '';
      
      if (mapping.type === 'static') {
        value = mapping.value || '';
      } else if (mapping.type === 'source' && mapping.source) {
        // New unified source format
        const rawValue = resolveSourceValue(mapping.source, exportData);
        // Find the prompt to get its variables for resolution
        const promptData = exportData.find(p => p.row_id === mapping.source!.promptId) || exportData[0];
        value = resolveContentVariables(rawValue, promptData, exportData);
      } else if (mapping.type === 'field' && exportData.length > 0) {
        // Legacy support: field from first prompt or specific prompt
        const promptData = mapping.promptId 
          ? exportData.find(p => p.row_id === mapping.promptId) || exportData[0]
          : exportData[0];
        const rawValue = String(promptData[mapping.fieldId || ''] || '');
        value = resolveContentVariables(rawValue, promptData, exportData);
      } else if (mapping.type === 'variable' && exportData.length > 0) {
        // Legacy support: variable from specific prompt
        const promptData = mapping.promptId 
          ? exportData.find(p => p.row_id === mapping.promptId) || exportData[0]
          : exportData[0];
        value = String(promptData[`var_${mapping.variableName}`] || '');
      }
      // Note: 'all' type is removed - no longer supported
      
      // Replace the template variable
      const regex = new RegExp(`<at:var\\s+at:name="${varName}"\\s*\\/?>`, 'gi');
      body = body.replace(regex, escapeHtml(value));
    });
    
    return body;
  }, [useBlankPage, selectedTemplate, templateMappings, resolveSourceValue, resolveContentVariables]);

  // Create the page
  const exportToConfluence = useCallback(async (exportData: ExportDataItem[]): Promise<CreatePageResult> => {
    console.log('[useConfluenceExport] exportToConfluence called:', {
      exportDataLength: exportData?.length,
      exportDataSample: exportData?.[0] ? Object.keys(exportData[0]) : [],
      pageTitle,
      pageTitleSource,
      selectedSpaceKey,
      selectedParentId,
      useBlankPage,
      templateMappings: Object.keys(templateMappings)
    });
    
    if (!selectedSpaceKey) {
      const error = new Error('Space is required');
      console.error('[useConfluenceExport] Validation error:', error.message);
      throw error;
    }

    // Resolve the page title from state
    let resolvedTitle = pageTitle;
    if (pageTitleSource) {
      resolvedTitle = resolveSourceValue(pageTitleSource, exportData) || pageTitle;
      console.log('[useConfluenceExport] Resolved dynamic title:', resolvedTitle);
    }
    
    // Apply default if empty
    if (!resolvedTitle || resolvedTitle.trim() === '') {
      resolvedTitle = DEFAULT_PAGE_TITLE;
      console.log('[useConfluenceExport] Using default title:', resolvedTitle);
    }

    // Find a unique title (auto-increment if needed)
    console.log('[useConfluenceExport] Finding unique title for:', resolvedTitle);
    const titleResult = await findUniqueTitle(selectedSpaceKey, resolvedTitle, selectedParentId);
    const finalTitle = titleResult.uniqueTitle;
    
    // Notify user if title was modified
    if (titleResult.wasModified) {
      toast.info(`Page created as "${finalTitle}" (original name already existed)`);
    }

    const body = buildPageBody(exportData);
    console.log('[useConfluenceExport] Built page body, length:', body?.length);
    console.log('[useConfluenceExport] Creating page with parentId:', selectedParentId, 'title:', finalTitle);
    
    try {
      const result = await createPage({
        spaceKey: selectedSpaceKey,
        parentId: selectedParentId,
        title: finalTitle,
        body
      });

      // Track successful export
      trackEvent('export_completed', {
        export_type: 'confluence',
        space_key: selectedSpaceKey,
        prompts_exported: exportData?.length || 0,
        used_template: !useBlankPage,
        title_was_incremented: titleResult.wasModified
      });

      return result;
    } catch (error) {
      // Track export failure
      trackEvent('export_failed', {
        export_type: 'confluence',
        error_message: error instanceof Error ? error.message : String(error),
      });
      trackException(error instanceof Error ? error : new Error(String(error)), { context: 'confluence_export' });
      throw error;
    }
  }, [selectedSpaceKey, selectedParentId, pageTitle, pageTitleSource, buildPageBody, createPage, findUniqueTitle, useBlankPage, resolveSourceValue, templateMappings]);

  // Reset state
  const reset = useCallback((): void => {
    setSelectedSpaceKey(null);
    setSelectedParentId(null);
    setSelectedTemplate(null);
    setTemplateMappings({});
    setPageTitle('');
    setUseBlankPage(true);
    setPageTitleSource(null);
    clearSpaceTree();
    clearTemplates();
  }, [clearSpaceTree, clearTemplates]);

  return {
    // State
    spaces,
    templates: templates as ConfluenceTemplate[],
    spaceTree,
    selectedSpaceKey,
    selectedParentId,
    selectedTemplate,
    templateMappings,
    pageTitle,
    useBlankPage,
    pageTitleSource,
    isLoadingTree,
    isLoadingTemplates,
    isCreatingPage,
    
    // Actions
    initialize,
    selectSpace,
    selectParent,
    selectTemplate,
    chooseBlankPage,
    updateMapping,
    setPageTitle,
    setPageTitleSource,
    exportToConfluence,
    reset,
    getPageChildren,
    setSpaceTree
  };
};
