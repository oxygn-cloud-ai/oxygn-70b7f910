import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FolderIcon, FileIcon } from 'lucide-react';

const Projects = () => {
  const dummyData = [
    {
      name: 'Project A',
      type: 'folder',
      children: [
        { name: 'file1.txt', type: 'file' },
        { name: 'file2.txt', type: 'file' },
        {
          name: 'Subfolder',
          type: 'folder',
          children: [
            { name: 'subfile1.txt', type: 'file' },
            { name: 'subfile2.txt', type: 'file' },
          ],
        },
      ],
    },
    {
      name: 'Project B',
      type: 'folder',
      children: [
        { name: 'fileB1.txt', type: 'file' },
        { name: 'fileB2.txt', type: 'file' },
      ],
    },
  ];

  const renderTree = (items) => {
    return (
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, index) => (
          <AccordionItem value={`item-${index}`} key={index}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center">
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
                {renderTree(item.children)}
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
