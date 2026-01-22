/**
 * Naming Template Utilities
 * Functions for generating dynamic naming strings based on templates
 */

/**
 * Convert a 0-indexed number to alphabetical sequence
 * @param num - 0-indexed number (0 = A, 1 = B, 26 = AA, etc.)
 * @param uppercase - Whether to use uppercase letters
 * @returns Alphabetical string
 */
export const numberToAlpha = (num: number, uppercase: boolean = true): string => {
  let result = '';
  let n = num;
  
  do {
    result = String.fromCharCode((n % 26) + (uppercase ? 65 : 97)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  
  return result;
};

/**
 * Pad a number with leading zeros
 * @param num - Number to pad
 * @param length - Desired total length
 * @returns Padded string
 */
export const padNumber = (num: number, length: number): string => {
  return num.toString().padStart(length, '0');
};

/**
 * Available template codes
 */
export const TEMPLATE_CODES = [
  { code: '{{n}}', description: 'Sequential number (1, 2, 3...)' },
  { code: '{{nn}}', description: 'Padded number (01, 02, 03...)' },
  { code: '{{nnn}}', description: 'Padded number (001, 002, 003...)' },
  { code: '{{A}}', description: 'Uppercase letters (A, B, C... AA, AB...)' },
  { code: '{{a}}', description: 'Lowercase letters (a, b, c... aa, ab...)' },
  { code: '{{date:FORMAT}}', description: 'Date with format (e.g., {{date:YYYY-MM-DD}})' },
];

/**
 * Common date format examples
 */
export const DATE_FORMAT_EXAMPLES = [
  { format: 'YYYY-MM-DD', example: '2024-01-15' },
  { format: 'DD/MM/YYYY', example: '15/01/2024' },
  { format: 'MMM YYYY', example: 'Jan 2024' },
  { format: 'YYYY', example: '2024' },
  { format: 'Q[Q]YYYY', example: 'Q1 2024' },
];

/**
 * Format a date according to a format string
 * @param date - Date to format
 * @param format - Format string
 * @returns Formatted date string
 */
const formatDate = (date: Date, format: string): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const quarter = Math.ceil(month / 3);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  let result = format;
  
  // Replace in order of specificity (longer patterns first)
  result = result.replace(/YYYY/g, year.toString());
  result = result.replace(/YY/g, year.toString().slice(-2));
  result = result.replace(/MMMM/g, fullMonthNames[month - 1]);
  result = result.replace(/MMM/g, monthNames[month - 1]);
  result = result.replace(/MM/g, padNumber(month, 2));
  result = result.replace(/M/g, month.toString());
  result = result.replace(/DD/g, padNumber(day, 2));
  result = result.replace(/D/g, day.toString());
  result = result.replace(/\[Q\]/g, 'Q');
  result = result.replace(/Q/g, quarter.toString());
  
  return result;
};

/**
 * Process a naming template with codes
 * @param template - Template string containing codes
 * @param sequenceNumber - Current sequence number (1-indexed)
 * @param date - Date to use for date codes
 * @returns Processed string
 */
export const processNamingTemplate = (
  template: string,
  sequenceNumber: number = 1,
  date: Date = new Date()
): string => {
  if (!template) return template;
  
  let result = template;
  
  // Replace sequential codes (use 0-indexed for alpha conversion)
  result = result.replace(/\{\{nnn\}\}/g, padNumber(sequenceNumber, 3));
  result = result.replace(/\{\{nn\}\}/g, padNumber(sequenceNumber, 2));
  result = result.replace(/\{\{n\}\}/g, sequenceNumber.toString());
  result = result.replace(/\{\{A\}\}/g, numberToAlpha(sequenceNumber - 1, true));
  result = result.replace(/\{\{a\}\}/g, numberToAlpha(sequenceNumber - 1, false));
  
  // Replace date codes
  const datePattern = /\{\{date:([^}]+)\}\}/g;
  result = result.replace(datePattern, (_, format: string) => formatDate(date, format));
  
  return result;
};

/**
 * Level naming configuration
 */
export interface LevelNamingConfig {
  prefix?: string;
  name?: string;
  suffix?: string;
}

/**
 * Full naming configuration
 */
export interface NamingConfig {
  levels?: LevelNamingConfig[];
  topLevelSets?: {
    [topLevelName: string]: LevelNamingConfig[];
  };
}

/**
 * Generate a prompt name from level configuration
 * @param levelConfig - Level-specific naming config
 * @param sequenceNumber - Current sequence number
 * @param date - Date for date codes
 * @returns Generated prompt name
 */
export const generatePromptName = (
  levelConfig: LevelNamingConfig,
  sequenceNumber: number = 1,
  date: Date = new Date()
): string => {
  const prefix = processNamingTemplate(levelConfig.prefix || '', sequenceNumber, date);
  const name = processNamingTemplate(levelConfig.name || '', sequenceNumber, date);
  const suffix = processNamingTemplate(levelConfig.suffix || '', sequenceNumber, date);
  
  return `${prefix}${name}${suffix}`.trim();
};

/**
 * Get naming configuration for a specific level
 * @param namingConfig - Full naming configuration
 * @param level - Hierarchy level (0 = top level)
 * @param topLevelName - Name of top-level prompt (for set-specific configs)
 * @returns Level naming configuration
 */
export const getLevelNamingConfig = (
  namingConfig: NamingConfig | null | undefined,
  level: number,
  topLevelName?: string | null
): LevelNamingConfig => {
  const defaultConfig: LevelNamingConfig = {
    prefix: '',
    name: `New Prompt`,
    suffix: '',
  };
  
  if (!namingConfig) return defaultConfig;
  
  // Check for top-level-specific configuration
  if (topLevelName && namingConfig.topLevelSets?.[topLevelName]) {
    const setConfig = namingConfig.topLevelSets[topLevelName];
    if (setConfig[level]) {
      return setConfig[level];
    }
  }
  
  // Fall back to default levels
  if (namingConfig.levels && namingConfig.levels[level]) {
    return namingConfig.levels[level];
  }
  
  return defaultConfig;
};

/**
 * Extract template codes used in a string
 * @param template - Template string to analyze
 * @returns Array of codes found
 */
export const extractTemplateCodes = (template: string): string[] => {
  const codes: string[] = [];
  const patterns = [
    /\{\{nnn\}\}/g,
    /\{\{nn\}\}/g,
    /\{\{n\}\}/g,
    /\{\{A\}\}/g,
    /\{\{a\}\}/g,
    /\{\{date:[^}]+\}\}/g,
  ];
  
  patterns.forEach(pattern => {
    const matches = template.match(pattern);
    if (matches) {
      codes.push(...matches);
    }
  });
  
  return [...new Set(codes)];
};

export default {
  numberToAlpha,
  padNumber,
  processNamingTemplate,
  generatePromptName,
  getLevelNamingConfig,
  extractTemplateCodes,
  TEMPLATE_CODES,
  DATE_FORMAT_EXAMPLES,
};
