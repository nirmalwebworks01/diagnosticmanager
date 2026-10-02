import React from 'react';

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
}

export default function PremiumLoader({ text = 'Loading...', fullScreen = false }: LoaderProps) {
  const content = (
    <div className="flex flex-col items-center gap-6">
      {/* Premium Conic Gradient Spinner */}
      <div className="relative w-14 h-14 flex items-center justify-center">
        {/* Outer glowing track */}
        <div className="absolute inset-0 rounded-full border-[3px] border-blue-50/50"></div>
        
        {/* Inner spinning gradient */}
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-blue-600 animate-spin shadow-[0_0_15px_rgba(37,99,235,0.2)]"></div>
        
        {/* Reverse spinning subtle ring */}
        <div 
          className="absolute inset-1.5 rounded-full border-[3px] border-transparent border-b-blue-400/50 animate-spin"
          style={{ animationDirection: 'reverse', animationDuration: '1.2s' }}
        ></div>
        
        {/* Center removed */}
      </div>
      
      {/* Elegant minimalist text */}
      {text && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.2em] text-gray-400 uppercase animate-pulse">
            {text}
          </span>
          {/* Decorative mini progress line */}
          <div className="w-12 h-0.5 rounded-full overflow-hidden bg-gray-100">
            <div className="h-full bg-blue-600 w-1/2 rounded-full animate-bounce" style={{ animationDuration: '2s' }}></div>
          </div>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-md">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-12 w-full">
      {content}
    </div>
  );
}
