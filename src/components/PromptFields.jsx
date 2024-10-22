import React from 'react';
import PromptField from './PromptField';

const PromptFields = ({
  localData,
  handleChange,
  handleReset,
  handleSave,
  isLinksPage,
  handleGenerate,
  isGenerating,
  formattedTime,
  isReadOnly,
  handleCascade,
  parentData,
  cascadeField,
  hasUnsavedChanges
}) => {
  const fields = [
    { name: 'input_admin_prompt', label: 'Input Admin Prompt' },
    { name: 'input_user_prompt', label: 'Input User Prompt' },
    { name: 'admin_prompt_result', label: 'Admin Result' },
    { name: 'user_prompt_result', label: 'User Result' },
    { name: 'note', label: 'Notes' }
  ];

  return (
    <div className="space-y-6">
      {fields.map(field => (
        <PromptField
          key={field.name}
          label={field.label}
          value={localData[field.name] || ''}
          onChange={(value) => handleChange(field.name, value)}
          onReset={() => handleReset(field.name)}
          onSave={() => handleSave(field.name)}
          initialValue={localData[field.name] || ''}
          onGenerate={isLinksPage ? null : handleGenerate}
          isGenerating={isGenerating}
          formattedTime={formattedTime}
          isLinksPage={isLinksPage}
          isReadOnly={isReadOnly}
          onCascade={() => handleCascade(field.name)}
          parentData={parentData}
          cascadeField={cascadeField}
          hasUnsavedChanges={hasUnsavedChanges(field.name)}
        />
      ))}
    </div>
  );
};

export default PromptFields;