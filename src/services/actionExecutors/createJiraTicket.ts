/**
 * Create Jira Ticket Action Executor
 * Creates Jira issues from prompt responses using the MCP connector
 */

import { supabase } from '@/integrations/supabase/client';
import type { 
  CreateJiraTicketConfig, 
  CreateJiraTicketContext, 
  CreateJiraTicketResult 
} from '@/types/jira';

/**
 * Resolve template variables in a string
 */
function resolveTemplate(
  template: string | undefined,
  context: CreateJiraTicketContext
): string {
  if (!template) return '';
  
  let result = template;
  
  // Replace {{response}} with the AI response
  result = result.replace(/\{\{response\}\}/gi, context.response);
  
  // Replace {{variable_name}} with variable values
  for (const [key, value] of Object.entries(context.variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    result = result.replace(regex, value);
  }
  
  return result;
}

/**
 * Execute the create_jira_ticket action
 * This uses the MCP connector's createJiraIssue tool
 */
export async function executeCreateJiraTicket(
  config: CreateJiraTicketConfig,
  context: CreateJiraTicketContext
): Promise<CreateJiraTicketResult> {
  try {
    // Resolve templates
    const summary = resolveTemplate(config.summary_template, context) || 
      context.response.slice(0, 200); // Fallback to first 200 chars of response
    
    const description = resolveTemplate(config.description_template, context) || 
      context.response;

    // Validate required fields
    if (!config.project_key) {
      return {
        success: false,
        error: 'Project key is required'
      };
    }

    if (!config.issue_type) {
      return {
        success: false,
        error: 'Issue type is required'
      };
    }

    // NOTE: This would typically call the MCP connector's createJiraIssue tool
    // The MCP connector is already available via platform tools
    // For now, we'll prepare the payload that would be sent
    
    const issuePayload = {
      projectKey: config.project_key,
      issueTypeName: config.issue_type,
      summary,
      description,
      ...(config.labels && config.labels.length > 0 && {
        additional_fields: {
          labels: config.labels
        }
      }),
      ...(config.priority && {
        additional_fields: {
          priority: { name: config.priority }
        }
      })
    };

    console.log('[createJiraTicket] Would create issue:', issuePayload);

    // TODO: When MCP connector is fully integrated, this will call:
    // await mcpConnector.invoke('createJiraIssue', issuePayload)
    
    // For now, return a placeholder response
    // The actual implementation will be completed when MCP is fully wired up
    return {
      success: false,
      error: 'Jira integration pending MCP connector setup. Please use the chat interface to create Jira issues.'
    };

  } catch (error) {
    console.error('[createJiraTicket] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Jira ticket'
    };
  }
}

export default executeCreateJiraTicket;
