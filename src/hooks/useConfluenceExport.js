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
    createPage,
    clearSpaceTree,
    clearTemplates
  } = useConfluencePages();

  const [selectedSpaceKey, setSelectedSpaceKey] = useState(null);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateMappings, setTemplateMappings] = useState({});
  const [pageTitle, setPageTitle] = useState('');
  const [useBlankPage, setUseBlankPage] = useState(true);

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

  // Select parent page/folder
  const selectParent = useCallback((parentId) => {
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
      } else if (mapping.type === 'field' && exportData.length > 0) {
        // Get value from first prompt's field
        value = exportData[0][mapping.fieldId] || '';
      } else if (mapping.type === 'variable' && exportData.length > 0) {
        value = exportData[0][`var_${mapping.variableName}`] || '';
      } else if (mapping.type === 'all') {
        // Concatenate from all prompts
        value = exportData.map(item => item[mapping.fieldId] || '').filter(Boolean).join('\n\n');
      }
      
      // Replace the template variable
      const regex = new RegExp(`<at:var\\s+at:name="${varName}"\\s*\\/?>`, 'gi');
      body = body.replace(regex, escapeHtml(value));
    });
    
    return body;
  }, [useBlankPage, selectedTemplate, templateMappings]);

  // Create the page
  const exportToConfluence = useCallback(async (exportData, title) => {
    if (!selectedSpaceKey || !title) {
      throw new Error('Space and title are required');
    }

    const body = buildPageBody(exportData);
    
    const result = await createPage({
      spaceKey: selectedSpaceKey,
      parentId: selectedParentId,
      title,
      body
    });

    return result;
  }, [selectedSpaceKey, selectedParentId, buildPageBody, createPage]);

  // Reset state
  const reset = useCallback(() => {
    setSelectedSpaceKey(null);
    setSelectedParentId(null);
    setSelectedTemplate(null);
    setTemplateMappings({});
    setPageTitle('');
    setUseBlankPage(true);
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
    exportToConfluence,
    reset
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
