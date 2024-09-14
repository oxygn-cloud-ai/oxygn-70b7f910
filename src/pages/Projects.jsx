import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FolderIcon, FileIcon, ChevronRightIcon, ChevronDownIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);

  const dummyData = [
    {
      id: '1',
      name: 'Project A',
      type: 'folder',
      children: [
        { id: '1-1', name: 'file1.txt', type: 'file' },
        { id: '1-2', name: 'file2.txt', type: 'file' },
        {
          id: '1-3',
          name: 'Subfolder',
          type: 'folder',
          children: [
            { id: '1-3-1', name: 'subfile1.txt', type: 'file' },
            { id: '1-3-2', name: 'subfile2.txt', type: 'file' },
          ],
        },
      ],
    },
    {
      id: '2',
      name: 'Project B',
      type: 'folder',
      children: [
        { id: '2-1', name: 'fileB1.txt', type: 'file' },
        { id: '2-2', name: 'fileB2.txt', type: 'file' },
      ],
    },
  ];

  const toggleItem = (itemId) => {
    setExpandedItems((prevExpanded) =>
      prevExpanded.includes(itemId)
        ? prevExpanded.filter((id) => id !== itemId)
        : [...prevExpanded, itemId]
    );
  };

  const renderTree = (items, level = 0) => {
    return (
      <Accordion
        type="multiple"
        value={expandedItems}
        onValueChange={setExpandedItems}
        className="w-full"
      >
        {items.map((item) => (
          <AccordionItem value={item.id} key={item.id} className="border-none">
            <AccordionTrigger
              onClick={() => toggleItem(item.id)}
              className={`hover:no-underline py-1 ${
                level > 0 ? `pl-${level * 4}` : ''
              }`}
            >
              <div className="flex items-center w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 mr-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleItem(item.id);
                  }}
                >
                  {expandedItems.includes(item.id) ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </Button>
                {item.type === 'folder' ? (
                  <FolderIcon className="mr-2 h-4 w-4" />
                ) : (
                  <FileIcon className="mr-2 h-4 w-4" />
                )}
                {item.name}
              </div>
            </AccordionTrigger>
            {item.children && (
              <AccordionContent>
                {renderTree(item.children, level + 1)}
              </AccordionContent>
            )}
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      <div className="border rounded-lg p-4">
        {renderTree(dummyData)}
      </div>
    </div>
  );
};

export default Projects;
