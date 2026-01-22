import React, { useState, useMemo } from 'react';
import { 
  Calendar, User, FileText, Briefcase, ChevronDown, ChevronRight,
  Lock, Plus, Trash2, Edit2, Check, X, Info,
  ArrowUp, ArrowDown, GitBranch
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  SYSTEM_VARIABLES, 
  SYSTEM_VARIABLE_TYPES,
  resolveStaticVariables,
  getUserEditableVariables,
} from '@/config/systemVariables';
import { useSystemVariables } from '@/hooks/useSystemVariables';
import { useAuth } from '@/contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Static system variable groups (read-only)
const STATIC_VARIABLE_GROUPS = [
  {
    id: 'datetime',
    label: 'Date & Time',
    icon: Calendar,
    variables: ['q.today', 'q.now', 'q.year', 'q.month'],
  },
  {
    id: 'user',
    label: 'User',
    icon: User,
    variables: ['q.user.name', 'q.user.email'],
  },
  {
    id: 'prompt',
    label: 'Prompt Context',
    icon: FileText,
    variables: ['q.prompt.name', 'q.toplevel.prompt.name', 'q.parent.prompt.name'],
  },
];

// User-editable policy variables
const EDITABLE_POLICY_VARIABLES = [
  'q.policy.version',
  'q.policy.owner', 
  'q.policy.effective.date',
  'q.policy.review.date',
  'q.client.name',
  'q.jurisdiction',
  'q.topic',
];

// AI Response variables (from last_ai_call_metadata)
const AI_RESPONSE_VARIABLES = [
  { name: 'q.response', label: 'AI Response', field: 'response' },
  { name: 'q.model', label: 'Model Used', field: 'model' },
  { name: 'q.tokens_input', label: 'Input Tokens', field: 'tokens_input' },
  { name: 'q.tokens_output', label: 'Output Tokens', field: 'tokens_output' },
  { name: 'q.tokens_total', label: 'Total Tokens', field: 'tokens_total' },
  { name: 'q.cost_total', label: 'Total Cost', field: 'cost_total' },
  { name: 'q.latency_ms', label: 'Latency (ms)', field: 'latency_ms' },
  { name: 'q.finish_reason', label: 'Finish Reason', field: 'finish_reason' },
];

const VariablesTabContent = ({ 
  promptData, 
  promptRowId,
  parentData = null,
  childrenData = [],
  siblingsData = [],
  // Shared variable state from parent (MainLayout)
  userVariables = [],
  isLoadingVariables = false,
  addVariable,
  updateVariable,
  deleteVariable,
}) => {
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState({
    system: true,
    policy: true,
    user: true,
    hierarchy: false,
    aiResponse: false,
  });

  // System variables hook for editable policy variables
  const {
    systemVariables,
    updateSystemVariable,
    isSaving: isSavingSystemVar,
    savingVarName,
  } = useSystemVariables(promptRowId, promptData?.system_variables);
  
  // Add variable state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  
  // Edit state for user variables
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Edit state for policy variables
  const [editingPolicyVar, setEditingPolicyVar] = useState(null);
  const [editPolicyValue, setEditPolicyValue] = useState('');

  // Resolve static system variables
  const resolvedStaticVars = useMemo(() => {
    return resolveStaticVariables({
      user,
      promptName: promptData?.prompt_name,
      topLevelPromptName: parentData?.prompt_name || promptData?.prompt_name,
      parentPromptName: parentData?.prompt_name,
    });
  }, [user, promptData?.prompt_name, parentData?.prompt_name]);

  // Get AI response metadata
  const aiMetadata = promptData?.last_ai_call_metadata || {};

  // Count static system variables
  const staticVarsCount = STATIC_VARIABLE_GROUPS.reduce((acc, g) => acc + g.variables.length, 0);

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Add variable handler
  const handleAdd = async () => {
    if (!newName.trim()) return;
    const result = await addVariable(newName.trim(), newValue, newDescription);
    if (result) {
      setIsAdding(false);
      setNewName('');
      setNewValue('');
      setNewDescription('');
    }
  };

  // Edit handlers for user variables
  const handleStartEdit = (variable) => {
    setEditingId(variable.row_id);
    setEditValue(variable.variable_value || '');
  };

  const handleSaveEdit = async (rowId) => {
    await updateVariable(rowId, { variable_value: editValue });
    setEditingId(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  // Edit handlers for policy variables
  const handleStartEditPolicy = (varName) => {
    setEditingPolicyVar(varName);
    setEditPolicyValue(systemVariables[varName] || '');
  };

  const handleSavePolicyEdit = async () => {
    if (editingPolicyVar) {
      const success = await updateSystemVariable(editingPolicyVar, editPolicyValue);
      if (success) {
        setEditingPolicyVar(null);
        setEditPolicyValue('');
      }
    }
  };

  const handleCancelPolicyEdit = () => {
    setEditingPolicyVar(null);
    setEditPolicyValue('');
  };

  // Section header component
  const SectionHeader = ({ icon: Icon, label, count, section, badge }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center gap-2 py-1.5 text-left group"
    >
      <div className="w-5 h-5 flex items-center justify-center">
        {expandedSections[section] ? (
          <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-on-surface-variant" />
        )}
      </div>
      <Icon className="h-3.5 w-3.5 text-on-surface-variant" />
      <span className="text-label-sm text-on-surface-variant uppercase tracking-wider flex-1">
        {label}
      </span>
      {badge && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
          {badge}
        </span>
      )}
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
        {count}
      </span>
    </button>
  );

  // Variable row component for static system variables
  const SystemVariableRow = ({ varName, value }) => {
    const def = SYSTEM_VARIABLES[varName];
    return (
      <div className="flex items-center gap-2.5 p-2 bg-surface-container rounded-m3-sm border border-outline-variant">
        <Lock className="h-3 w-3 text-on-surface-variant shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <code className="text-body-sm text-on-surface font-mono">{`{{${varName}}}`}</code>
            <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/10 text-green-600">auto</span>
          </div>
          {def?.description && (
            <p className="text-[10px] text-on-surface-variant truncate">{def.description}</p>
          )}
        </div>
        <div className="w-32 shrink-0">
          <div className="h-7 px-2 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface-variant truncate font-mono">
            {value || '—'}
          </div>
        </div>
      </div>
    );
  };

  // Editable policy variable row
  const EditablePolicyVariableRow = ({ varName }) => {
    const def = SYSTEM_VARIABLES[varName];
    const value = systemVariables[varName] || '';
    const isEditing = editingPolicyVar === varName;
    const isSavingThis = isSavingSystemVar && savingVarName === varName;
    
    return (
      <div className="flex items-center gap-2.5 p-2 bg-surface-container rounded-m3-sm border border-outline-variant group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <code className="text-body-sm text-on-surface font-mono">{`{{${varName}}}`}</code>
          </div>
          {def?.description && (
            <p className="text-[10px] text-on-surface-variant truncate">{def.description}</p>
          )}
        </div>
        
        {isEditing ? (
          <>
            {def?.inputType === 'select' && def.options ? (
              <Select value={editPolicyValue} onValueChange={setEditPolicyValue}>
                <SelectTrigger className="w-32 h-7 text-body-sm border-primary">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {def.options.map(opt => (
                    <SelectItem key={opt} value={opt} className="text-body-sm">
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                type="text"
                value={editPolicyValue}
                onChange={(e) => setEditPolicyValue(e.target.value)}
                placeholder={def?.placeholder || ''}
                className="w-32 h-7 px-2 bg-surface-container-high rounded-m3-sm border border-primary text-body-sm text-on-surface focus:outline-none font-mono"
                autoFocus
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleSavePolicyEdit}
                  disabled={isSavingThis}
                  className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-surface-container disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Save</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleCancelPolicyEdit}
                  className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Cancel</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <div className="w-32 shrink-0">
              <div className="h-7 px-2 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface truncate font-mono">
                {value || <span className="text-on-surface-variant italic">empty</span>}
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => handleStartEditPolicy(varName)}
                  className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Edit</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    );
  };

  // User variable row with edit/delete
  const UserVariableRow = ({ variable }) => {
    const isEditing = editingId === variable.row_id;
    
    return (
      <div className="flex items-center gap-2.5 p-2 bg-surface-container rounded-m3-sm border border-outline-variant group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <code className="text-body-sm text-on-surface font-mono">{`{{${variable.variable_name}}}`}</code>
            {variable.is_required && (
              <span className="text-[10px] text-destructive">*</span>
            )}
          </div>
          {variable.variable_description && (
            <p className="text-[10px] text-on-surface-variant truncate">{variable.variable_description}</p>
          )}
        </div>
        
        {isEditing ? (
          <>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-32 h-7 px-2 bg-surface-container-high rounded-m3-sm border border-primary text-body-sm text-on-surface focus:outline-none font-mono"
              autoFocus
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => handleSaveEdit(variable.row_id)}
                  className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-surface-container"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Save</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleCancelEdit}
                  className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Cancel</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <div className="w-32 shrink-0">
              <div className="h-7 px-2 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface truncate font-mono">
                {variable.variable_value || <span className="text-on-surface-variant italic">empty</span>}
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => handleStartEdit(variable)}
                  className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Edit</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => deleteVariable(variable.row_id)}
                  className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:text-destructive hover:bg-surface-container opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Delete</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    );
  };

  // Hierarchy variable row (parent/child/sibling)
  const HierarchyVariableRow = ({ type, promptName, extractedVars }) => {
    const Icon = type === 'parent' ? ArrowUp : type === 'child' ? ArrowDown : GitBranch;
    const typeColors = {
      parent: 'text-purple-500 bg-purple-500/10',
      child: 'text-blue-500 bg-blue-500/10',
      sibling: 'text-amber-500 bg-amber-500/10',
    };
    
    if (!extractedVars || Object.keys(extractedVars).length === 0) {
      return null;
    }

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${typeColors[type].split(' ')[0]}`} />
          <span className="text-body-sm text-on-surface font-medium">{promptName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeColors[type]}`}>
            {type}
          </span>
        </div>
        <div className="ml-5 space-y-1">
          {Object.entries(extractedVars).map(([key, value]) => (
            <div 
              key={key}
              className="flex items-center gap-2.5 p-2 bg-surface-container rounded-m3-sm border border-outline-variant"
            >
              <code className="text-body-sm text-on-surface font-mono flex-1 truncate">
                {`{{q.${promptName?.toLowerCase().replace(/\s+/g, '_')}.${key}}}`}
              </code>
              <div className="w-32 shrink-0">
                <div className="h-7 px-2 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface-variant truncate font-mono">
                  {typeof value === 'object' ? JSON.stringify(value).slice(0, 20) + '...' : String(value).slice(0, 20)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Count hierarchy variables
  const hierarchyCount = useMemo(() => {
    let count = 0;
    if (parentData?.extracted_variables) {
      count += Object.keys(parentData.extracted_variables).length;
    }
    childrenData.forEach(child => {
      if (child?.extracted_variables) {
        count += Object.keys(child.extracted_variables).length;
      }
    });
    siblingsData.forEach(sibling => {
      if (sibling?.extracted_variables) {
        count += Object.keys(sibling.extracted_variables).length;
      }
    });
    return count;
  }, [parentData, childrenData, siblingsData]);

  // Count AI response variables with values
  const aiResponseCount = useMemo(() => {
    return AI_RESPONSE_VARIABLES.filter(v => aiMetadata[v.field] !== undefined).length;
  }, [aiMetadata]);

  return (
    <div className="space-y-4">
      {/* Static System Variables Section */}
      <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-2">
        <SectionHeader 
          icon={Lock} 
          label="System Variables" 
          count={staticVarsCount}
          section="system"
          badge="read-only"
        />
        
        {expandedSections.system && (
          <div className="space-y-3 ml-5">
            {STATIC_VARIABLE_GROUPS.map(group => (
              <div key={group.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <group.icon className="h-3.5 w-3.5 text-on-surface-variant" />
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.variables.map(varName => (
                    <SystemVariableRow 
                      key={varName}
                      varName={varName}
                      value={resolvedStaticVars[varName]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editable Policy Variables Section */}
      <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-2">
        <SectionHeader 
          icon={Briefcase} 
          label="Policy Variables" 
          count={EDITABLE_POLICY_VARIABLES.length}
          section="policy"
          badge="editable"
        />
        
        {expandedSections.policy && (
          <div className="space-y-1.5 ml-5">
            {EDITABLE_POLICY_VARIABLES.map(varName => (
              <EditablePolicyVariableRow key={varName} varName={varName} />
            ))}
          </div>
        )}
      </div>

      {/* User Variables Section */}
      <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <SectionHeader 
            icon={FileText} 
            label="User Variables" 
            count={userVariables.length}
            section="user"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setIsAdding(true)}
                disabled={isAdding}
                className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Add Variable</TooltipContent>
          </Tooltip>
        </div>
        
        {expandedSections.user && (
          <div className="space-y-1.5 ml-5">
            {/* Add form */}
            {isAdding && (
              <div className="p-2.5 bg-surface-container rounded-m3-md border border-primary/50 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Variable name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:border-primary font-mono"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="flex-1 h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full h-7 px-2 bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface focus:outline-none focus:border-primary"
                />
                <div className="flex justify-end gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => setIsAdding(false)}
                        className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Cancel</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={handleAdd}
                        disabled={!newName.trim()}
                        className="w-6 h-6 flex items-center justify-center rounded-m3-full text-primary hover:bg-surface-container disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Add</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}
            
            {/* Variables list */}
            {isLoadingVariables ? (
              <div className="text-[10px] text-on-surface-variant text-center py-3">Loading...</div>
            ) : userVariables.length === 0 && !isAdding ? (
              <div className="text-[10px] text-on-surface-variant text-center py-3">
                No user variables. Click + to add one.
              </div>
            ) : (
              userVariables.map(variable => (
                <UserVariableRow key={variable.row_id} variable={variable} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Hierarchy Variables Section (Parent/Children/Siblings) */}
      <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-2">
        <SectionHeader 
          icon={GitBranch} 
          label="Hierarchy Variables" 
          count={hierarchyCount}
          section="hierarchy"
        />
        
        {expandedSections.hierarchy && (
          <div className="space-y-3 ml-5">
            {/* Parent */}
            {parentData && (
              <HierarchyVariableRow 
                type="parent"
                promptName={parentData.prompt_name}
                extractedVars={parentData.extracted_variables}
              />
            )}
            
            {/* Children */}
            {childrenData.map((child, index) => (
              <HierarchyVariableRow 
                key={child.row_id || index}
                type="child"
                promptName={child.prompt_name}
                extractedVars={child.extracted_variables}
              />
            ))}
            
            {/* Siblings */}
            {siblingsData.filter(s => s.row_id !== promptData?.row_id).map((sibling, index) => (
              <HierarchyVariableRow 
                key={sibling.row_id || index}
                type="sibling"
                promptName={sibling.prompt_name}
                extractedVars={sibling.extracted_variables}
              />
            ))}
            
            {hierarchyCount === 0 && (
              <div className="text-[10px] text-on-surface-variant text-center py-3">
                No hierarchy variables available. Run prompts to populate extracted variables.
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Response Variables Section */}
      <div className="bg-surface-container-low rounded-m3-lg p-3 space-y-2">
        <SectionHeader 
          icon={Info} 
          label="AI Response" 
          count={aiResponseCount}
          section="aiResponse"
        />
        
        {expandedSections.aiResponse && (
          <div className="space-y-1 ml-5">
            {aiResponseCount === 0 ? (
              <div className="text-[10px] text-on-surface-variant text-center py-3">
                No AI calls made yet. Run a prompt to populate response variables.
              </div>
            ) : (
              AI_RESPONSE_VARIABLES.filter(v => aiMetadata[v.field] !== undefined).map(v => (
                <div 
                  key={v.name}
                  className="flex items-center gap-2.5 p-2 bg-surface-container rounded-m3-sm border border-outline-variant"
                >
                  <Lock className="h-3 w-3 text-on-surface-variant shrink-0" />
                  <div className="flex-1 min-w-0">
                    <code className="text-body-sm text-on-surface font-mono">{`{{${v.name}}}`}</code>
                    <p className="text-[10px] text-on-surface-variant">{v.label}</p>
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="h-7 px-2 flex items-center bg-surface-container-high rounded-m3-sm border border-outline-variant text-body-sm text-on-surface-variant truncate font-mono">
                      {v.name === 'q.response' 
                        ? (aiMetadata[v.field] || '').slice(0, 20) + '...'
                        : String(aiMetadata[v.field] ?? '—')
                      }
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VariablesTabContent;
