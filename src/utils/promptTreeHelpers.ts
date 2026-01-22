/**
 * Prompt Tree Helpers
 * 
 * Centralized utilities for traversing and querying hierarchical prompt trees.
 * These functions are used throughout the application for finding prompts,
 * checking relationships, and extracting data from the tree structure.
 */

import type { PromptTreeNode, PromptData } from '@/types';

// ============= Types =============
export interface FindResult<T = PromptTreeNode> {
  node: T | null;
  path: T[];
}

// ============= Core Tree Traversal =============

/**
 * Find a node in the tree by its row_id or id
 */
export function findNodeById(
  nodes: PromptTreeNode[],
  targetId: string
): PromptTreeNode | null {
  for (const node of nodes) {
    const nodeId = node.row_id || node.id;
    if (nodeId === targetId) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find a node and return the path to it (array of ancestor nodes)
 */
export function findNodeWithPath(
  nodes: PromptTreeNode[],
  targetId: string,
  currentPath: PromptTreeNode[] = []
): FindResult<PromptTreeNode> {
  for (const node of nodes) {
    const nodeId = node.row_id || node.id;
    if (nodeId === targetId) {
      return { node, path: currentPath };
    }
    if (node.children && node.children.length > 0) {
      const result = findNodeWithPath(node.children, targetId, [...currentPath, node]);
      if (result.node) return result;
    }
  }
  return { node: null, path: [] };
}

/**
 * Check if a node has children
 */
export function hasChildren(
  nodes: PromptTreeNode[],
  targetId: string
): boolean {
  const node = findNodeById(nodes, targetId);
  return node?.children ? node.children.length > 0 : false;
}

/**
 * Find and check if node has children in one traversal
 */
export function findNodeAndCheckChildren(
  nodes: PromptTreeNode[],
  targetId: string
): boolean | null {
  for (const node of nodes) {
    const nodeId = node.row_id || node.id;
    if (nodeId === targetId) {
      return node.children && node.children.length > 0;
    }
    if (node.children && node.children.length > 0) {
      const result = findNodeAndCheckChildren(node.children, targetId);
      if (result !== null) return result;
    }
  }
  return null;
}

// ============= Tree Flattening =============

/**
 * Flatten a tree into an array of all nodes with depth information
 */
export interface FlatNode extends PromptTreeNode {
  depth: number;
  parentId: string | null;
}

export function flattenTree(
  nodes: PromptTreeNode[],
  depth: number = 0,
  parentId: string | null = null
): FlatNode[] {
  const result: FlatNode[] = [];
  
  for (const node of nodes) {
    result.push({
      ...node,
      depth,
      parentId,
    });
    
    if (node.children && node.children.length > 0) {
      const childNodes = flattenTree(
        node.children,
        depth + 1,
        node.row_id || node.id || null
      );
      result.push(...childNodes);
    }
  }
  
  return result;
}

/**
 * Get all descendant IDs of a node
 */
export function getAllDescendantIds(node: PromptTreeNode): string[] {
  const ids: string[] = [];
  
  const traverse = (n: PromptTreeNode) => {
    const id = n.row_id || n.id;
    if (id) ids.push(id);
    if (n.children) {
      n.children.forEach(traverse);
    }
  };
  
  if (node.children) {
    node.children.forEach(traverse);
  }
  
  return ids;
}

/**
 * Get all nodes matching a predicate
 */
export function filterNodes(
  nodes: PromptTreeNode[],
  predicate: (node: PromptTreeNode) => boolean
): PromptTreeNode[] {
  const result: PromptTreeNode[] = [];
  
  const traverse = (nodeList: PromptTreeNode[]) => {
    for (const node of nodeList) {
      if (predicate(node)) {
        result.push(node);
      }
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  };
  
  traverse(nodes);
  return result;
}

// ============= Tree Statistics =============

/**
 * Count total nodes in tree
 */
export function countNodes(nodes: PromptTreeNode[]): number {
  let count = 0;
  
  const traverse = (nodeList: PromptTreeNode[]) => {
    for (const node of nodeList) {
      count++;
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  };
  
  traverse(nodes);
  return count;
}

/**
 * Get maximum depth of tree
 */
export function getMaxDepth(nodes: PromptTreeNode[], currentDepth: number = 0): number {
  let maxDepth = currentDepth;
  
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const childDepth = getMaxDepth(node.children, currentDepth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  }
  
  return maxDepth;
}

// ============= Parent/Ancestor Utilities =============

/**
 * Find the parent node of a given node
 */
export function findParentNode(
  nodes: PromptTreeNode[],
  targetId: string
): PromptTreeNode | null {
  const result = findNodeWithPath(nodes, targetId);
  if (result.path.length > 0) {
    return result.path[result.path.length - 1];
  }
  return null;
}

/**
 * Get the root ancestor of a node (top-level node in the tree)
 */
export function getRootAncestor(
  nodes: PromptTreeNode[],
  targetId: string
): PromptTreeNode | null {
  const result = findNodeWithPath(nodes, targetId);
  if (result.path.length > 0) {
    return result.path[0];
  }
  // If no path, the node itself is a root
  return result.node;
}

/**
 * Check if nodeA is an ancestor of nodeB
 */
export function isAncestorOf(
  nodes: PromptTreeNode[],
  ancestorId: string,
  descendantId: string
): boolean {
  const result = findNodeWithPath(nodes, descendantId);
  return result.path.some(node => (node.row_id || node.id) === ancestorId);
}

// ============= Sibling Utilities =============

/**
 * Get sibling nodes (nodes at the same level with the same parent)
 */
export function getSiblings(
  nodes: PromptTreeNode[],
  targetId: string
): PromptTreeNode[] {
  // Check if target is at root level
  const isAtRoot = nodes.some(n => (n.row_id || n.id) === targetId);
  if (isAtRoot) {
    return nodes.filter(n => (n.row_id || n.id) !== targetId);
  }
  
  // Find parent and return its other children
  const parent = findParentNode(nodes, targetId);
  if (parent && parent.children) {
    return parent.children.filter(n => (n.row_id || n.id) !== targetId);
  }
  
  return [];
}

// ============= Model Utilities =============

/**
 * Check if a prompt uses a specific model provider
 */
export function isModelProvider(
  nodes: PromptTreeNode[],
  targetId: string,
  models: Array<{ model_id: string; model_name?: string; provider: string }>,
  provider: string
): boolean {
  const node = findNodeById(nodes, targetId);
  if (!node?.model) return false;
  
  const modelData = models.find(
    m => m.model_id === node.model || m.model_name === node.model
  );
  return modelData?.provider === provider;
}

/**
 * Get all prompts using a specific model
 */
export function getPromptsByModel(
  nodes: PromptTreeNode[],
  modelId: string
): PromptTreeNode[] {
  return filterNodes(nodes, node => node.model === modelId);
}

// ============= Starred/Filtered Utilities =============

/**
 * Get all starred prompts
 */
export function getStarredPrompts(nodes: PromptTreeNode[]): PromptTreeNode[] {
  return filterNodes(nodes, node => node.starred === true);
}

/**
 * Get prompts excluded from cascade
 */
export function getCascadeExcludedPrompts(nodes: PromptTreeNode[]): PromptTreeNode[] {
  return filterNodes(nodes, node => node.exclude_from_cascade === true);
}

/**
 * Get prompts excluded from export
 */
export function getExportExcludedPrompts(nodes: PromptTreeNode[]): PromptTreeNode[] {
  return filterNodes(nodes, node => node.exclude_from_export === true);
}

/**
 * Get prompts that are conversation/assistant enabled
 */
export function getAssistantPrompts(nodes: PromptTreeNode[]): PromptTreeNode[] {
  return filterNodes(nodes, node => node.is_assistant === true);
}
