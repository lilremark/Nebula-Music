import React from 'react';
import { Home, Compass, Search, Radio, Settings } from 'lucide-react';
import { useStore } from '../context/Store';
import { View } from '../types';

export const MobileNav: React.FC = () => {
  const { currentView, setView, openSearchModal } = useStore();

  const isActive = (view: View | View[]) => {
    if (Array.isArray(view)) return view.includes(currentView);
    return currentView === view;
  };

  const NavButton = ({
    icon: Icon,
    label,
    active,
    onClick
  }: {
    icon: any;
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center space-y-1 flex-1 h-full 
        transition-all duration-300 ease-spring rounded-2xl relative group interactive-press
        ${active ? 'text-primary' : 'text-neutral-500'}
      `}
    >
      {/* Active indicator background */}
      {active && (
        <div className="absolute inset-x-2 inset-y-1 bg-gradient-to-b from-primary/20 to-primary/10 rounded-2xl border border-primary/30 animate-scale-in shadow-glow-sm" />
      )}

      <Icon className={`
        w-6 h-6 relative z-10 transition-all duration-300 ease-spring
        ${active ? 'fill-primary/20 scale-110' : 'group-active:scale-90'}
      `} />
      <span className={`
        text-[10px] font-medium relative z-10 transition-all duration-200
        ${active ? 'font-bold tracking-wide' : ''}
      `}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-safe animate-slide-up">
      <div className="floating-panel-strong rounded-3xl border border-white/15 mx-auto max-w-md mb-3 shadow-[0_8px_40px_-8px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />

        <div className="relative flex items-center justify-between px-3 py-2 h-[68px]">
          <NavButton
            icon={Home}
            label="Home"
            active={isActive('HOME')}
            onClick={() => setView('HOME')}
          />

          <NavButton
            icon={Compass}
            label="Browse"
            active={isActive('BROWSE')}
            onClick={() => setView('BROWSE')}
          />

          {/* Center Search Button */}
          <button
            onClick={openSearchModal}
            className="flex flex-col items-center justify-center space-y-1 flex-1 h-full group relative interactive-press"
            aria-label="Search"
          >
            <div className="w-14 h-10 bg-gradient-to-br from-primary/30 to-secondary/30 rounded-2xl flex items-center justify-center group-active:scale-95 transition-all duration-200 ease-spring border border-white/15 shadow-glow-sm group-hover:shadow-glow glow-button">
              <Search className="w-5 h-5 text-white relative z-10" />
            </div>
          </button>

          <NavButton
            icon={Radio}
            label="Radio"
            active={isActive('RADIO')}
            onClick={() => setView('RADIO')}
          />

          <NavButton
            icon={Settings}
            label="Settings"
            active={isActive('SETTINGS')}
            onClick={() => setView('SETTINGS')}
          />
        </div>
      </div>
    </div>
  );
};
