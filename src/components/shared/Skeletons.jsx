import * as React from "react";

// Base skeleton component with shimmer animation
export const Skeleton = ({ className = "", animate = true }) => (
  <div 
    className={`bg-on-surface/[0.08] rounded-m3-sm ${animate ? "animate-pulse" : ""} ${className}`}
  />
);

// Text skeleton with variable width
export const SkeletonText = ({ width = "w-24", size = "sm" }) => {
  const heights = {
    xs: "h-2",
    sm: "h-3",
    md: "h-4",
    lg: "h-5"
  };
  return <Skeleton className={`${heights[size]} ${width}`} />;
};

// Circle skeleton for avatars/icons
export const SkeletonCircle = ({ size = "md" }) => {
  const sizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
    xl: "w-12 h-12"
  };
  return <Skeleton className={`${sizes[size]} rounded-full`} />;
};

// Card skeleton
export const SkeletonCard = ({ lines = 3, hasIcon = false }) => (
  <div className="p-3 bg-surface-container-low rounded-m3-lg border border-outline-variant space-y-3 animate-fade-in">
    <div className="flex items-center gap-3">
      {hasIcon && <SkeletonCircle size="md" />}
      <div className="flex-1 space-y-2">
        <SkeletonText width="w-32" size="md" />
        <SkeletonText width="w-48" size="sm" />
      </div>
    </div>
    {lines > 0 && (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonText 
            key={i} 
            width={i === lines - 1 ? "w-2/3" : "w-full"} 
            size="sm" 
          />
        ))}
      </div>
    )}
  </div>
);

// List item skeleton
export const SkeletonListItem = ({ hasAvatar = false, hasActions = false }) => (
  <div className="flex items-center gap-3 p-2.5 rounded-m3-sm animate-pulse">
    {hasAvatar && <SkeletonCircle size="sm" />}
    <div className="flex-1 space-y-1.5">
      <SkeletonText width="w-28" size="sm" />
      <SkeletonText width="w-20" size="xs" />
    </div>
    {hasActions && (
      <div className="flex gap-1">
        <Skeleton className="w-6 h-6 rounded-m3-full" />
        <Skeleton className="w-6 h-6 rounded-m3-full" />
      </div>
    )}
  </div>
);

// Thread list skeleton
export const SkeletonThreadList = ({ count = 3 }) => (
  <div className="space-y-1">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonListItem key={i} hasAvatar={false} />
    ))}
  </div>
);

// Message skeleton for chat
export const SkeletonMessage = ({ isUser = false }) => (
  <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
    <div 
      className={`max-w-[70%] p-3 rounded-2xl space-y-2 ${
        isUser ? "bg-primary/20" : "bg-surface-container"
      }`}
    >
      <SkeletonText width="w-full" size="sm" />
      <SkeletonText width="w-4/5" size="sm" />
      <SkeletonText width="w-1/2" size="sm" />
    </div>
  </div>
);

// Chat skeleton
export const SkeletonChat = () => (
  <div className="space-y-3 p-3">
    <SkeletonMessage isUser={false} />
    <SkeletonMessage isUser={true} />
    <SkeletonMessage isUser={false} />
  </div>
);

// Settings row skeleton
export const SkeletonSettingRow = () => (
  <div className="flex items-center justify-between py-2 animate-pulse">
    <div className="space-y-1">
      <SkeletonText width="w-24" size="sm" />
      <SkeletonText width="w-32" size="xs" />
    </div>
    <Skeleton className="w-10 h-5 rounded-full" />
  </div>
);

// Form field skeleton
export const SkeletonFormField = ({ label = true }) => (
  <div className="space-y-1.5 animate-pulse">
    {label && <SkeletonText width="w-16" size="xs" />}
    <Skeleton className="w-full h-8 rounded-m3-sm" />
  </div>
);

// Table skeleton
export const SkeletonTable = ({ rows = 3, cols = 4 }) => (
  <div className="space-y-1 animate-pulse">
    {/* Header */}
    <div className="flex gap-3 p-2">
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonText key={i} width={i === 0 ? "flex-1" : "w-20"} size="xs" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-3 p-2 bg-surface-container rounded-m3-sm">
        {Array.from({ length: cols }).map((_, colIndex) => (
          <SkeletonText key={colIndex} width={colIndex === 0 ? "flex-1" : "w-20"} size="sm" />
        ))}
      </div>
    ))}
  </div>
);

// Variable row skeleton
export const SkeletonVariableRow = () => (
  <div className="flex items-center gap-3 p-2.5 bg-surface-container rounded-m3-sm border border-outline-variant animate-pulse">
    <SkeletonCircle size="sm" />
    <div className="flex-1 space-y-1">
      <SkeletonText width="w-24" size="sm" />
      <SkeletonText width="w-36" size="xs" />
    </div>
    <Skeleton className="w-32 h-7 rounded-m3-sm" />
  </div>
);

// Prompt editor skeleton
export const SkeletonPromptEditor = () => (
  <div className="space-y-4 animate-fade-in">
    {/* System prompt */}
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <SkeletonText width="w-20" size="xs" />
        <Skeleton className="w-6 h-6 rounded-sm" />
      </div>
      <Skeleton className="w-full h-40 rounded-m3-md" />
    </div>
    {/* User prompt */}
    <div className="space-y-1.5">
      <SkeletonText width="w-16" size="xs" />
      <Skeleton className="w-full h-20 rounded-m3-md" />
    </div>
    {/* Output */}
    <div className="space-y-1.5">
      <SkeletonText width="w-12" size="xs" />
      <Skeleton className="w-full h-32 rounded-m3-md" />
    </div>
  </div>
);

export default {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonCard,
  SkeletonListItem,
  SkeletonThreadList,
  SkeletonMessage,
  SkeletonChat,
  SkeletonSettingRow,
  SkeletonFormField,
  SkeletonTable,
  SkeletonVariableRow,
  SkeletonPromptEditor,
};
