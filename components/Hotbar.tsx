
import React from 'react';
import { ItemStack } from '../constants';
import { ItemIcon } from './Inventory';

interface HotbarProps {
  inventory: (ItemStack | null)[];
  selectedSlot: number;
  worldVersion?: number;
}

const Hotbar: React.FC<HotbarProps> = ({ inventory, selectedSlot, worldVersion = 0 }) => {
  const hotbarSlots = inventory.slice(27, 36);

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex gap-1 p-1 bg-black/60 border-2 sm:border-4 border-zinc-800 rounded-md scale-90 sm:scale-125 z-40 shadow-2xl backdrop-blur-sm transition-transform">
      {hotbarSlots.map((item, i) => (
        <div 
          key={i}
          className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center relative rounded-sm transition-all ${
            selectedSlot === i ? 'bg-white/30 border-2 border-white' : 'bg-black/20 border-2 border-transparent hover:bg-black/40'
          }`}
        >
          {item && <ItemIcon item={item} version={worldVersion} />}
          <span className="absolute top-0 left-1 text-[7px] sm:text-[8px] text-zinc-400 font-mono select-none">
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
};

export default Hotbar;
