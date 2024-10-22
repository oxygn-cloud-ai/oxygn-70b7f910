import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

const Test = () => {
  const [prompts, setPrompts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const { data, error } = await supabase
          .from('prompts')
          .select('*');
        
        if (error) throw error;
        
        setPrompts(data);
      } catch (error) {
        console.error('Error fetching prompts:', error);
        toast.error(`Failed to fetch prompts: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrompts();
  }, []);

  if (isLoading) {
    return <div className="p-4">Loading prompts...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Prompts Table Records</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border-b">Row ID</th>
              <th className="px-4 py-2 border-b">Prompt Name</th>
              <th className="px-4 py-2 border-b">Created</th>
              <th className="px-4 py-2 border-b">Is Deleted</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((prompt) => (
              <tr key={prompt.row_id}>
                <td className="px-4 py-2 border-b">{prompt.row_id}</td>
                <td className="px-4 py-2 border-b">{prompt.prompt_name}</td>
                <td className="px-4 py-2 border-b">{prompt.created}</td>
                <td className="px-4 py-2 border-b">{prompt.is_deleted ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Test;