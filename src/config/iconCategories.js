// Icon categories with pattern matchers for all 1400+ Lucide icons
export const ICON_CATEGORIES = {
  all: {
    name: 'All',
    patterns: [],
  },
  arrows: {
    name: 'Arrows',
    patterns: ['arrow', 'chevron', 'corner', 'move', 'undo', 'redo', 'rotate', 'refresh', 'repeat', 'flip', 'iteration'],
  },
  communication: {
    name: 'Communication',
    patterns: ['mail', 'message', 'chat', 'inbox', 'send', 'phone', 'contact', 'at-sign', 'bell', 'megaphone', 'rss', 'radio', 'podcast', 'mic', 'voicemail', 'speech'],
  },
  devices: {
    name: 'Devices',
    patterns: ['monitor', 'laptop', 'tablet', 'smartphone', 'phone', 'tv', 'watch', 'cpu', 'hard-drive', 'keyboard', 'mouse', 'printer', 'projector', 'screen', 'display', 'desktop', 'server', 'router', 'usb', 'bluetooth', 'wifi', 'airplay', 'cast'],
  },
  files: {
    name: 'Files & Folders',
    patterns: ['file', 'folder', 'document', 'archive', 'clipboard', 'copy', 'paste', 'save', 'download', 'upload', 'import', 'export', 'attachment', 'paperclip'],
  },
  media: {
    name: 'Media',
    patterns: ['play', 'pause', 'stop', 'skip', 'rewind', 'fast-forward', 'volume', 'speaker', 'headphone', 'music', 'video', 'film', 'camera', 'image', 'photo', 'picture', 'gallery', 'album', 'disc', 'radio', 'podcast', 'mic', 'youtube', 'twitch'],
  },
  shapes: {
    name: 'Shapes',
    patterns: ['circle', 'square', 'rectangle', 'triangle', 'pentagon', 'hexagon', 'octagon', 'diamond', 'star', 'heart', 'cross', 'plus', 'minus', 'x', 'dot', 'box', 'cube', 'cylinder', 'cone', 'sphere', 'torus', 'pyramid'],
  },
  social: {
    name: 'Social',
    patterns: ['user', 'users', 'person', 'people', 'group', 'team', 'contact', 'profile', 'account', 'avatar', 'badge', 'id', 'share', 'thumbs', 'like', 'heart', 'bookmark', 'flag', 'twitter', 'facebook', 'instagram', 'linkedin', 'github', 'dribbble', 'figma', 'slack', 'discord'],
  },
  tools: {
    name: 'Tools',
    patterns: ['wrench', 'hammer', 'screwdriver', 'tool', 'settings', 'cog', 'gear', 'config', 'sliders', 'filter', 'sort', 'funnel', 'brush', 'paint', 'pen', 'pencil', 'eraser', 'scissors', 'ruler', 'compass', 'pipette', 'dropper', 'magic', 'wand', 'sparkle'],
  },
  ui: {
    name: 'UI Elements',
    patterns: ['menu', 'grid', 'list', 'layout', 'panel', 'sidebar', 'header', 'footer', 'nav', 'tab', 'modal', 'dialog', 'popup', 'tooltip', 'badge', 'tag', 'label', 'button', 'toggle', 'switch', 'check', 'radio', 'input', 'select', 'dropdown', 'search', 'zoom', 'expand', 'collapse', 'maximize', 'minimize', 'fullscreen', 'split', 'merge', 'dock', 'pin', 'unpin'],
  },
  weather: {
    name: 'Weather',
    patterns: ['sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'wind', 'storm', 'thunder', 'lightning', 'fog', 'mist', 'haze', 'tornado', 'rainbow', 'umbrella', 'thermometer', 'temperature', 'sunrise', 'sunset', 'dawn', 'dusk'],
  },
  nature: {
    name: 'Nature',
    patterns: ['tree', 'leaf', 'flower', 'plant', 'grass', 'forest', 'mountain', 'wave', 'water', 'flame', 'fire', 'earth', 'globe', 'world', 'map', 'compass', 'anchor', 'ship', 'boat', 'fish', 'bird', 'bug', 'cat', 'dog', 'rabbit', 'squirrel', 'turtle', 'snail', 'bee', 'butterfly'],
  },
  business: {
    name: 'Business',
    patterns: ['briefcase', 'building', 'office', 'chart', 'graph', 'analytics', 'trending', 'dollar', 'euro', 'pound', 'yen', 'bitcoin', 'coin', 'credit', 'wallet', 'bank', 'receipt', 'invoice', 'percent', 'calculator', 'presentation', 'pie', 'bar', 'line', 'kanban', 'gantt', 'calendar', 'clock', 'timer', 'alarm', 'schedule', 'milestone', 'target', 'goal', 'trophy', 'award', 'medal', 'crown', 'gem'],
  },
  security: {
    name: 'Security',
    patterns: ['lock', 'unlock', 'key', 'shield', 'secure', 'guard', 'fingerprint', 'scan', 'eye', 'eye-off', 'visible', 'invisible', 'password', 'encrypted', 'verified', 'check', 'alert', 'warning', 'danger', 'error', 'bug', 'virus', 'ban', 'block', 'forbidden'],
  },
  development: {
    name: 'Development',
    patterns: ['code', 'terminal', 'command', 'console', 'bracket', 'braces', 'hash', 'function', 'variable', 'database', 'server', 'api', 'webhook', 'git', 'branch', 'merge', 'commit', 'pull', 'push', 'fork', 'bug', 'test', 'package', 'npm', 'container', 'docker', 'kubernetes', 'cloud', 'deploy', 'rocket', 'zap', 'bolt', 'sparkle'],
  },
  health: {
    name: 'Health',
    patterns: ['heart', 'pulse', 'activity', 'stethoscope', 'syringe', 'pill', 'capsule', 'bandage', 'hospital', 'ambulance', 'wheelchair', 'brain', 'bone', 'dna', 'flask', 'microscope', 'thermometer', 'apple', 'carrot', 'salad', 'dumbbell', 'fitness', 'weight', 'scale', 'meditation', 'yoga'],
  },
  travel: {
    name: 'Travel',
    patterns: ['plane', 'flight', 'car', 'bus', 'train', 'subway', 'bike', 'bicycle', 'motorcycle', 'truck', 'ship', 'boat', 'anchor', 'compass', 'map', 'navigation', 'route', 'road', 'highway', 'fuel', 'gas', 'parking', 'ticket', 'passport', 'luggage', 'suitcase', 'backpack', 'tent', 'camp', 'hotel', 'bed', 'home', 'house', 'building'],
  },
  education: {
    name: 'Education',
    patterns: ['book', 'library', 'bookmark', 'graduation', 'school', 'university', 'pencil', 'pen', 'notebook', 'sticky', 'note', 'highlighter', 'ruler', 'calculator', 'atom', 'flask', 'beaker', 'microscope', 'telescope', 'globe', 'languages', 'translate', 'abc', 'spell', 'quote', 'heading', 'paragraph', 'text', 'type', 'font', 'bold', 'italic', 'underline', 'strikethrough', 'list', 'indent', 'align'],
  },
  food: {
    name: 'Food & Drink',
    patterns: ['utensils', 'fork', 'knife', 'spoon', 'plate', 'bowl', 'cup', 'mug', 'glass', 'wine', 'beer', 'coffee', 'tea', 'milk', 'juice', 'bottle', 'pizza', 'burger', 'sandwich', 'hotdog', 'taco', 'salad', 'soup', 'egg', 'bacon', 'bread', 'croissant', 'cake', 'cookie', 'candy', 'ice-cream', 'popcorn', 'apple', 'banana', 'cherry', 'grape', 'lemon', 'orange', 'peach', 'pear', 'strawberry', 'watermelon', 'carrot', 'corn', 'pepper', 'tomato'],
  },
};

// Categorize an icon name into its category
export const categorizeIcon = (iconName) => {
  const lowerName = iconName.toLowerCase();
  
  for (const [categoryKey, category] of Object.entries(ICON_CATEGORIES)) {
    if (categoryKey === 'all') continue;
    
    for (const pattern of category.patterns) {
      if (lowerName.includes(pattern.toLowerCase())) {
        return categoryKey;
      }
    }
  }
  
  return 'all'; // Default to 'all' if no match
};

// Get all icon names grouped by category
export const getIconsByCategory = (iconNames, categoryKey) => {
  if (categoryKey === 'all') {
    return iconNames;
  }
  
  return iconNames.filter(name => categorizeIcon(name) === categoryKey);
};

// Search icons by name
export const searchIcons = (iconNames, query) => {
  if (!query || query.trim() === '') {
    return iconNames;
  }
  
  const lowerQuery = query.toLowerCase();
  return iconNames.filter(name => name.toLowerCase().includes(lowerQuery));
};
