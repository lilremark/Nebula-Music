import React, { useId, useRef } from 'react';

export type PlayerTab = 'Queue' | 'Details';
const tabs: PlayerTab[] = ['Queue', 'Details'];

interface StudioPlayerTabsProps {
  selected: PlayerTab;
  onSelect: (tab: PlayerTab) => void;
  queueCount: number;
  queue: React.ReactNode;
  details: React.ReactNode;
}

/** Studio's controlled, keyboard-accessible player tabs; selection stays in the lab. */
export function StudioPlayerTabs({ selected, onSelect, queueCount, queue, details }: StudioPlayerTabsProps) {
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKey(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    onSelect(tabs[next]);
    buttons.current[next]?.focus();
  }

  return <>
    <div className="rf-studio-tabs" role="tablist" aria-label="Player information" data-active={selected}>
      <span className="rf-studio-tab-indicator" aria-hidden="true" />
      {tabs.map((tab, index) => <button
        key={tab}
        ref={node => { buttons.current[index] = node; }}
        type="button"
        role="tab"
        id={`${id}-${tab}-tab`}
        aria-controls={`${id}-${tab}-panel`}
        aria-selected={selected === tab}
        tabIndex={selected === tab ? 0 : -1}
        className="rf-studio-tab"
        onClick={() => onSelect(tab)}
        onKeyDown={event => handleKey(event, index)}
      ><span className="rf-studio-tab-label">{tab}</span>{tab === 'Queue' && <span className="rf-studio-tab-count">{queueCount}</span>}</button>)}
    </div>
    {tabs.map(tab => <div
      key={tab}
      role="tabpanel"
      id={`${id}-${tab}-panel`}
      aria-labelledby={`${id}-${tab}-tab`}
      hidden={selected !== tab}
      tabIndex={0}
      className="rf-studio-tab-panel"
    >{tab === 'Queue' ? queue : details}</div>)}
  </>;
}
