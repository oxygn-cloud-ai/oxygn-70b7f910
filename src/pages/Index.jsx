import React from 'react';
import { useSupabase } from '../hooks/useSupabase';
import useTreeData from '../hooks/useTreeData';

const Index = () => {
  const supabase = useSupabase();
  const { treeData, isLoading } = useTreeData(supabase);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Your App</h1>
        <p className="text-xl text-gray-600 mb-4">Start building your amazing project here!</p>
        {isLoading ? (
          <p className="text-lg text-blue-600">Loading accordion data...</p>
        ) : (
          <p className="text-lg text-green-600">Accordion data loaded successfully!</p>
        )}
      </div>
    </div>
  );
};

export default Index;
