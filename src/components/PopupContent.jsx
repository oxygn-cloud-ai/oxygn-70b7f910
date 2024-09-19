import React from 'react';
import { Button } from "@/components/ui/button";
import { Link } from 'lucide-react';

const PopupContent = ({ isExpanded, isLoading, selectedItem }) => {
  const renderField = (label, content) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold">{label}</h4>
        <Button variant="ghost" size="sm" className="p-0">
          <Link className="h-4 w-4" />
        </Button>
      </div>
      <div className="bg-gray-100 p-2 rounded-md overflow-auto max-h-40">
        <pre className="text-sm font-sans whitespace-pre-wrap">{content}</pre>
      </div>
    </div>
  );

  return (
    <div className={`${isExpanded ? 'w-2/3' : 'w-full'} pl-4 overflow-y-auto`}>
      <div className="mt-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <p>Loading...</p>
          </div>
        ) : selectedItem ? (
          <>
            {renderField("Admin Prompt", selectedItem.input_admin_prompt || '')}
            {renderField("User Prompt", selectedItem.input_user_prompt || '')}
            {renderField("Admin Prompt Result", selectedItem.admin_prompt_result || '')}
            {renderField("User Prompt Result", selectedItem.user_prompt_result || '')}
          </>
        ) : (
          <div className="flex justify-center items-center h-full">
            <p>Select a prompt to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PopupContent;
