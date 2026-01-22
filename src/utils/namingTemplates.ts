import { format } from 'date-fns';

/**
 * Converts a number to an alphabetical sequence (A, B, C, ... Z, AA, AB, etc.)
 * @param {number} num - 0-indexed number
 * @param {boolean} uppercase - Whether to use uppercase letters
 * @returns {string}
 */
export const numberToAlpha = (num, uppercase = true) => {
  let result = '';
  let n = num;
  
  do {
    result = String.fromCharCode((n % 26) + (uppercase ? 65 : 97)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  
  return result;
};

/**
 * Pads a number with leading zeros
 * @param {number} num - Number to pad
 * @param {number} length - Desired length
 * @returns {string}
 */
export const padNumber = (num, length) => {
  return String(num).padStart(length, '0');
};

/**
 * Available template codes for naming
 */
export const TEMPLATE_CODES = [
  { code: '{{n}}', description: 'Sequential number (1, 2, 3...)', example: '1' },
  { code: '{{nn}}', description: 'Zero-padded number (01, 02...)', example: '01' },
  { code: '{{nnn}}', description: 'Zero-padded 3 digits (001, 002...)', example: '001' },
  { code: '{{A}}', description: 'Uppercase alpha (A, B...Z, AA, AB...)', example: 'A' },
  { code: '{{a}}', description: 'Lowercase alpha (a, b...z, aa, ab...)', example: 'a' },
  { code: '{{date:FORMAT}}', description: 'Date with format (use date-fns tokens)', example: '{{date:yyyy-MM-dd}}' },
];

/**
 * Common date format examples
 */
export const DATE_FORMAT_EXAMPLES = [
  { format: 'yyyy-MM-dd', example: '2024-12-16' },
  { format: 'dd/MM/yyyy', example: '16/12/2024' },
  { format: 'MMM dd', example: 'Dec 16' },
  { format: 'MMMM yyyy', example: 'December 2024' },
  { format: 'yyyyMMdd', example: '20241216' },
  { format: 'HH:mm', example: '14:30' },
  { format: 'yyyy-MM-dd HH:mm', example: '2024-12-16 14:30' },
];

/**
 * Processes a naming template and replaces codes with actual values
 * @param {string} template - The template string with codes
 * @param {number} sequenceNumber - The sequence number (0-indexed) for this item
 * @param {Date} date - The date to use for date formatting (defaults to now)
 * @returns {string}
 */
export const processNamingTemplate = (template, sequenceNumber = 0, date = new Date()) => {
  if (!template) return '';
  
  let result = template;
  const displayNum = sequenceNumber + 1; // Convert to 1-indexed for display
  
  // Process {{nnn...}} patterns (variable length zero-padding)
  result = result.replace(/\{\{(n+)\}\}/g, (match, ns) => {
    return padNumber(displayNum, ns.length);
  });
  
  // Process {{A}} uppercase alpha
  result = result.replace(/\{\{A\}\}/g, () => {
    return numberToAlpha(sequenceNumber, true);
  });
  
  // Process {{a}} lowercase alpha
  result = result.replace(/\{\{a\}\}/g, () => {
    return numberToAlpha(sequenceNumber, false);
  });
  
  // Process {{date:FORMAT}} patterns
  result = result.replace(/\{\{date:([^}]+)\}\}/g, (match, formatStr) => {
    try {
      return format(date, formatStr);
    } catch (e) {
      console.error('Invalid date format:', formatStr, e);
      return match; // Return original if format is invalid
    }
  });
  
  return result;
};

/**
 * Generates a full prompt name from naming config
 * @param {object} levelConfig - The level configuration { name, prefix, suffix }
 * @param {number} sequenceNumber - The sequence number (0-indexed) among siblings
 * @param {Date} date - The date to use
 * @returns {string}
 */
export const generatePromptName = (levelConfig, sequenceNumber = 0, date = new Date()) => {
  const { name = 'Prompt', prefix = '', suffix = '' } = levelConfig || {};
  
  const processedPrefix = processNamingTemplate(prefix, sequenceNumber, date);
  const processedName = processNamingTemplate(name, sequenceNumber, date);
  const processedSuffix = processNamingTemplate(suffix, sequenceNumber, date);
  
  return `${processedPrefix}${processedName}${processedSuffix}`.trim();
};

/**
 * Gets the naming configuration for a specific level and optional top-level set
 * @param {object} namingConfig - The full naming configuration from settings
 * @param {number} level - The hierarchy level (0-indexed)
 * @param {string} topLevelName - The name of the top-level prompt (for set matching)
 * @returns {object} - The level config { name, prefix, suffix }
 */
export const getLevelNamingConfig = (namingConfig, level, topLevelName = null) => {
  if (!namingConfig) {
    return { name: 'Prompt', prefix: '', suffix: '' };
  }
  
  // Check if there's a matching top-level set
  if (topLevelName && namingConfig.topLevelSets?.[topLevelName]) {
    const setConfig = namingConfig.topLevelSets[topLevelName];
    if (setConfig.levels?.[level]) {
      return setConfig.levels[level];
    }
    // If level doesn't exist in set, use the last available level
    if (setConfig.levels?.length > 0) {
      return setConfig.levels[setConfig.levels.length - 1];
    }
  }
  
  // Fall back to default levels
  if (namingConfig.levels?.[level]) {
    return namingConfig.levels[level];
  }
  
  // If level doesn't exist, use the last available level
  if (namingConfig.levels?.length > 0) {
    return namingConfig.levels[namingConfig.levels.length - 1];
  }
  
  return { name: 'Prompt', prefix: '', suffix: '' };
};
