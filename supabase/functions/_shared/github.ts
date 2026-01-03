/**
 * GitHub API utilities for Qonsol AI workbench
 * Provides read-only access to the application source code repository
 */

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  sha?: string;
}

interface GitHubFileContent {
  content: string;
  size: number;
  sha: string;
  encoding: string;
  truncated?: boolean;
}

interface GitHubSearchResult {
  path: string;
  matches: string[];
  sha: string;
}

/**
 * List files and directories at a given path in the repository
 */
export async function listGithubFiles(
  path: string = '',
  token: string,
  owner: string,
  repo: string
): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Qonsol-Workbench'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  
  // Handle single file response
  if (!Array.isArray(data)) {
    return [{
      name: data.name,
      path: data.path,
      type: data.type,
      size: data.size,
      sha: data.sha
    }];
  }

  return data.map((item: any) => ({
    name: item.name,
    path: item.path,
    type: item.type,
    size: item.size,
    sha: item.sha
  }));
}

/**
 * Read the content of a file from the repository
 * Large files are truncated with a note
 */
export async function readGithubFile(
  filePath: string,
  token: string,
  owner: string,
  repo: string,
  maxSize: number = 50000  // 50KB default limit
): Promise<GitHubFileContent> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Qonsol-Workbench'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  
  if (data.type !== 'file') {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  // Decode base64 content
  let content: string;
  let truncated = false;
  
  if (data.encoding === 'base64') {
    const decoded = atob(data.content.replace(/\n/g, ''));
    if (decoded.length > maxSize) {
      content = decoded.substring(0, maxSize) + `\n\n... [File truncated. Total size: ${data.size} bytes, showing first ${maxSize} bytes]`;
      truncated = true;
    } else {
      content = decoded;
    }
  } else {
    content = data.content;
  }

  return {
    content,
    size: data.size,
    sha: data.sha,
    encoding: data.encoding,
    truncated
  };
}

/**
 * Search for code patterns in the repository
 * Uses GitHub's code search API
 */
export async function searchGithubCode(
  query: string,
  token: string,
  owner: string,
  repo: string,
  fileExtension?: string,
  maxResults: number = 10
): Promise<GitHubSearchResult[]> {
  // Build search query
  let searchQuery = `${query} repo:${owner}/${repo}`;
  if (fileExtension) {
    searchQuery += ` extension:${fileExtension}`;
  }

  const url = `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&per_page=${maxResults}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3.text-match+json',
      'User-Agent': 'Qonsol-Workbench'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    // GitHub search has stricter rate limits
    if (response.status === 403) {
      throw new Error('GitHub code search rate limit exceeded. Please wait a moment and try again.');
    }
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  
  return data.items?.map((item: any) => ({
    path: item.path,
    sha: item.sha,
    matches: item.text_matches?.map((tm: any) => tm.fragment) || []
  })) || [];
}

/**
 * Get repository tree (recursive file listing)
 * Useful for getting an overview of the entire codebase
 */
export async function getRepositoryTree(
  token: string,
  owner: string,
  repo: string,
  path: string = '',
  recursive: boolean = false
): Promise<GitHubFile[]> {
  // Get the default branch first
  const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const repoResponse = await fetch(repoUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Qonsol-Workbench'
    }
  });

  if (!repoResponse.ok) {
    throw new Error(`Failed to get repo info: ${repoResponse.status}`);
  }

  const repoData = await repoResponse.json();
  const defaultBranch = repoData.default_branch || 'main';

  // Get tree
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}${recursive ? '?recursive=1' : ''}`;
  const treeResponse = await fetch(treeUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Qonsol-Workbench'
    }
  });

  if (!treeResponse.ok) {
    throw new Error(`Failed to get tree: ${treeResponse.status}`);
  }

  const treeData = await treeResponse.json();
  
  let files = treeData.tree?.map((item: any) => ({
    name: item.path.split('/').pop(),
    path: item.path,
    type: item.type === 'tree' ? 'dir' : 'file',
    size: item.size,
    sha: item.sha
  })) || [];

  // Filter by path if specified
  if (path) {
    files = files.filter((f: GitHubFile) => f.path.startsWith(path));
  }

  return files;
}

/**
 * Tool definitions for GitHub access - Using Responses API flat format
 */
export function getGithubTools() {
  return [
    {
      type: "function",
      name: "github_list_files",
      description: "List files and directories at a path in the application source code. Use empty string for root directory.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory path to list (e.g., 'src/components', 'supabase/functions'). Empty for root."
          }
        },
        required: [],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "github_read_file",
      description: "Read the content of a source code file. Large files are automatically truncated.",
      parameters: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: "Full path to the file (e.g., 'src/App.jsx', 'supabase/functions/workbench-chat/index.ts')"
          }
        },
        required: ["file_path"],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "github_search_code",
      description: "Search for code patterns, function names, or text in the application source code.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query - function names, variable names, text patterns, etc."
          },
          file_extension: {
            type: "string",
            description: "Optional file extension filter (e.g., 'ts', 'jsx', 'sql')"
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    },
    {
      type: "function",
      name: "github_get_structure",
      description: "Get the full directory structure of the application source code or a subdirectory. Useful for understanding codebase organization.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Optional path to filter (e.g., 'src', 'supabase'). Empty for full repo structure."
          }
        },
        required: [],
        additionalProperties: false
      }
    }
  ];
}

/**
 * Handle GitHub tool calls
 */
export async function handleGithubToolCall(
  toolName: string,
  args: any,
  token: string,
  owner: string,
  repo: string
): Promise<string> {
  // Validate required parameters
  if (!owner || !repo) {
    return JSON.stringify({ error: 'GitHub repository not configured' });
  }

  try {
    switch (toolName) {
      case 'github_list_files': {
        const { path = '' } = args;
        const files = await listGithubFiles(path, token, owner, repo);
        return JSON.stringify({
          path: path || '/',
          count: files.length,
          files: files.map(f => ({
            name: f.name,
            type: f.type,
            path: f.path,
            size: f.size
          }))
        });
      }

      case 'github_read_file': {
        const { file_path } = args;
        if (!file_path) {
          return JSON.stringify({ error: 'file_path is required' });
        }
        const file = await readGithubFile(file_path, token, owner, repo);
        return JSON.stringify({
          path: file_path,
          size: file.size,
          truncated: file.truncated || false,
          content: file.content
        });
      }

      case 'github_search_code': {
        const { query, file_extension } = args;
        if (!query) {
          return JSON.stringify({ error: 'query is required' });
        }
        const results = await searchGithubCode(query, token, owner, repo, file_extension);
        return JSON.stringify({
          query,
          count: results.length,
          results: results.map(r => ({
            path: r.path,
            matches: r.matches.slice(0, 3)  // Limit match snippets
          }))
        });
      }

      case 'github_get_structure': {
        const { path = '' } = args;
        const files = await getRepositoryTree(token, owner, repo, path, true);
        
        // Group by directory for cleaner output
        const structure: Record<string, string[]> = {};
        for (const file of files) {
          const dir = file.path.includes('/') 
            ? file.path.substring(0, file.path.lastIndexOf('/'))
            : '/';
          if (!structure[dir]) structure[dir] = [];
          structure[dir].push(file.name + (file.type === 'dir' ? '/' : ''));
        }
        
        return JSON.stringify({
          path: path || '/',
          total_files: files.filter(f => f.type === 'file').length,
          total_dirs: files.filter(f => f.type === 'dir').length,
          structure
        });
      }

      default:
        return JSON.stringify({ error: `Unknown GitHub tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`GitHub tool ${toolName} error:`, error);
    return JSON.stringify({ 
      error: error instanceof Error ? error.message : 'GitHub API request failed' 
    });
  }
}
