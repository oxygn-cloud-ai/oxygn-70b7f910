import { useState, useCallback } from 'react';
import { useConfluencePages } from './useConfluencePages';

export const useConfluenceExport = () => {
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
    clearSpaceTree,
    clearTemplates,
    setSpaceTree
  } = useConfluencePages();

  const [selectedSpaceKey, setSelectedSpaceKey] = useState(null);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateMappings, setTemplateMappings] = useState({});
  const [pageTitle, setPageTitle] = useState('');
  const [useBlankPage, setUseBlankPage] = useState(true);
  
  // New: Page title can be dynamic from a variable source
  // { promptId, sourceType: 'field' | 'variable', sourceId } or null for static
  const [pageTitleSource, setPageTitleSource] = useState(null);

  // Initialize - load spaces
  const initialize = useCallback(async () => {
    await listSpaces();
  }, [listSpaces]);

  // Select a space - load its tree and templates
  const selectSpace = useCallback(async (spaceKey) => {
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
  const selectParent = useCallback((parentId) => {
    console.log('[useConfluenceExport] selectParent called with:', parentId);
    setSelectedParentId(parentId);
  }, []);

  // Select a template
  const selectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setUseBlankPage(false);
    // Initialize mappings for template variables
    if (template?.variables) {
      const initialMappings = {};
      template.variables.forEach(varName => {
        initialMappings[varName] = { type: 'static', value: '' };
      });
      setTemplateMappings(initialMappings);
    }
  }, []);

  // Use blank page instead of template
  const chooseBlankPage = useCallback(() => {
    setUseBlankPage(true);
    setSelectedTemplate(null);
    setTemplateMappings({});
  }, []);

  // Update a template variable mapping
  const updateMapping = useCallback((variableName, mapping) => {
    setTemplateMappings(prev => ({
      ...prev,
      [variableName]: mapping
    }));
  }, []);

  // Resolve a value from export data based on source
  const resolveSourceValue = useCallback((source, exportData) => {
    if (!source || !exportData || exportData.length === 0) return '';
    
    // Find the prompt data
    const promptData = exportData.find(p => p.row_id === source.promptId);
    if (!promptData) {
      // Fallback to first prompt if not found
      const firstPrompt = exportData[0];
      if (source.sourceType === 'field') {
        return firstPrompt[source.sourceId] || '';
      } else if (source.sourceType === 'variable') {
        return firstPrompt[`var_${source.sourceId}`] || '';
      }
      return '';
    }
    
    if (source.sourceType === 'field') {
      return promptData[source.sourceId] || '';
    } else if (source.sourceType === 'variable') {
      return promptData[`var_${source.sourceId}`] || '';
    }
    
    return '';
  }, []);

  // Build the page body from template and mappings
  const buildPageBody = useCallback((exportData) => {
    if (useBlankPage || !selectedTemplate) {
      // Build a simple page from export data
      let body = '<h1>Exported Content</h1>';
      
      exportData.forEach(item => {
        body += `<h2>${item.prompt_name || 'Untitled Prompt'}</h2>`;
        
        // Use output_response (already normalized to include user_prompt_result)
        if (item.output_response) {
          body += `<h3>Output</h3><p>${escapeHtml(item.output_response)}</p>`;
        }
        if (item.input_user_prompt) {
          body += `<h3>User Prompt</h3><p>${escapeHtml(item.input_user_prompt)}</p>`;
        }
        if (item.input_admin_prompt) {
          body += `<h3>System Prompt</h3><p>${escapeHtml(item.input_admin_prompt)}</p>`;
        }
        if (item.note) {
          body += `<h3>Notes</h3><p>${escapeHtml(item.note)}</p>`;
        }
        
        // Add variables
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
        value = resolveSourceValue(mapping.source, exportData);
      } else if (mapping.type === 'field' && exportData.length > 0) {
        // Legacy support: field from first prompt or specific prompt
        const promptData = mapping.promptId 
          ? exportData.find(p => p.row_id === mapping.promptId) || exportData[0]
          : exportData[0];
        value = promptData[mapping.fieldId] || '';
      } else if (mapping.type === 'variable' && exportData.length > 0) {
        // Legacy support: variable from specific prompt
        const promptData = mapping.promptId 
          ? exportData.find(p => p.row_id === mapping.promptId) || exportData[0]
          : exportData[0];
        value = promptData[`var_${mapping.variableName}`] || '';
      }
      // Note: 'all' type is removed - no longer supported
      
      // Replace the template variable
      const regex = new RegExp(`<at:var\\s+at:name="${varName}"\\s*\\/?>`, 'gi');
      body = body.replace(regex, escapeHtml(value));
    });
    
    return body;
  }, [useBlankPage, selectedTemplate, templateMappings, resolveSourceValue]);

  // Create the page
  const exportToConfluence = useCallback(async (exportData, title) => {
    console.log('[useConfluenceExport] exportToConfluence called:', {
      exportDataLength: exportData?.length,
      exportDataSample: exportData?.[0] ? Object.keys(exportData[0]) : [],
      title,
      selectedSpaceKey,
      selectedParentId,
      useBlankPage,
      pageTitleSource,
      templateMappings: Object.keys(templateMappings)
    });
    
    if (!selectedSpaceKey) {
      const error = new Error('Space is required');
      console.error('[useConfluenceExport] Validation error:', error.message);
      throw error;
    }

    // Resolve the page title - either static or from a source
    let resolvedTitle = title;
    if (pageTitleSource) {
      resolvedTitle = resolveSourceValue(pageTitleSource, exportData) || title;
      console.log('[useConfluenceExport] Resolved dynamic title:', resolvedTitle);
    }
    
    if (!resolvedTitle) {
      const error = new Error('Page title is required');
      console.error('[useConfluenceExport] Validation error:', error.message);
      throw error;
    }

    const body = buildPageBody(exportData);
    console.log('[useConfluenceExport] Built page body, length:', body?.length);
    console.log('[useConfluenceExport] Creating page with parentId:', selectedParentId);
    
    const result = await createPage({
      spaceKey: selectedSpaceKey,
      parentId: selectedParentId,
      title: resolvedTitle,
      body
    });

    return result;
  }, [selectedSpaceKey, selectedParentId, buildPageBody, createPage, useBlankPage, pageTitleSource, resolveSourceValue, templateMappings]);

  // Reset state
  const reset = useCallback(() => {
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
    templates,
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

// Helper to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br/>');
}
