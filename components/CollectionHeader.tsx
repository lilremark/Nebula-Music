import React, { useLayoutEffect, useRef } from 'react';

interface CollectionHeaderProps {
  title: string;
  artwork: React.ReactNode;
  metadata: React.ReactNode;
  actions: React.ReactNode;
}

export const CollectionHeader: React.FC<CollectionHeaderProps> = ({ title, artwork, metadata, actions }) => {
  const headerRef = useRef<HTMLElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const header = headerRef.current;
    const spacer = spacerRef.current;
    const scroller = header?.closest('main');
    if (!header || !spacer || !scroller) return;
    const metadata = header.querySelector<HTMLElement>('.nebula-collection-meta');
    let frame = 0;
    const update = () => {
      frame = 0;
      const collapse = Math.min(1, Math.max(0, scroller.scrollTop / 240));
      header.style.setProperty('--collection-collapse', String(collapse));
      // Preserve the document height while the sticky header contracts.
      spacer.style.setProperty('--collection-collapse', String(collapse));
      header.dataset.compact = String(collapse === 1);
      metadata?.toggleAttribute('inert', collapse === 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <>
    <header ref={headerRef} className="nebula-collection-header" data-nebula-detail-hero data-nebula-collection-header>
      <div className="nebula-collection-heading" data-nebula-detail-hero-inner>
        <div className="nebula-collection-cover" data-nebula-detail-cover>{artwork}</div>
        <div className="nebula-collection-info" data-nebula-detail-info>
          <h1 title={title}>{title}</h1>
          <div className="nebula-collection-meta">{metadata}</div>
        </div>
      </div>
      <div className="nebula-collection-actions" data-nebula-detail-separator>{actions}</div>
    </header>
    <div ref={spacerRef} className="nebula-collection-spacer" aria-hidden="true" />
  </>;
};
