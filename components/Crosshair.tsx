
import React from 'react';

const Crosshair: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
      <div className="w-4 h-4 relative">
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white opacity-80 -translate-y-1/2"></div>
        <div className="absolute left-1/2 top-0 h-full w-[2px] bg-white opacity-80 -translate-x-1/2"></div>
      </div>
    </div>
  );
};

export default Crosshair;
