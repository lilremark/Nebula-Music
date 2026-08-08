import React, { useEffect, useRef, useState } from 'react';

const COVER_GRADIENTS: [string, string][] = [
    ['#06b6d4', '#8b5cf6'], // cyan -> violet
    ['#8b5cf6', '#ec4899'], // violet -> pink
    ['#ec4899', '#f59e0b'], // pink -> amber
    ['#f59e0b', '#10b981'], // amber -> emerald
    ['#10b981', '#06b6d4'], // emerald -> cyan
    ['#3b82f6', '#8b5cf6'], // blue -> violet
    ['#f43f5e', '#f59e0b'], // rose -> amber
    ['#14b8a6', '#3b82f6'], // teal -> blue
    ['#a855f7', '#ec4899'], // purple -> pink
    ['#f97316', '#f43f5e'], // orange -> rose
    ['#22d3ee', '#3b82f6'], // sky -> blue
    ['#84cc16', '#14b8a6'], // lime -> teal
    ['#e879f9', '#818cf8'], // fuchsia -> indigo
    ['#fbbf24', '#f97316'], // amber -> orange
    ['#2dd4bf', '#22d3ee'], // teal -> sky
    ['#c084fc', '#f472b6'], // violet -> pink
];

const COVERS = COVER_GRADIENTS.map(([from, to], i) => ({
    id: i,
    background: `linear-gradient(135deg, ${from}, ${to})`,
}));

const COVER_SIZE = 120;
const SPACING = 110;

export const CoverFlow: React.FC = () => {
    const [progress, setProgress] = useState(0);
    const [size, setSize] = useState(COVER_SIZE);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const measure = () => {
            const height = container.clientHeight;
            if (height > 0) setSize(Math.max(140, Math.round(height * 0.42)));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let raf = 0;
        let last = performance.now();
        const tick = (now: number) => {
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            setProgress((p) => p + dt * 0.12);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    const N = COVERS.length;
    const spacing = Math.round(size * 0.92);

    return (
        <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ perspective: '1200px' }}>
            <div className="absolute inset-0 flex items-center justify-center" style={{ transformStyle: 'preserve-3d' }}>
                {COVERS.map((cover, i) => {
                    let rel = i - (progress % N);
                    if (rel > N / 2) rel -= N;
                    if (rel < -N / 2) rel += N;
                    const abs = Math.abs(rel);
                    const tx = rel * spacing;
                    const rotY = rel * -18;
                    const scale = Math.max(0.55, 1 - abs * 0.07);
                    const opacity = Math.max(0.25, 1 - abs * 0.12);
                    return (
                        <div
                            key={cover.id}
                            className="absolute rounded-xl shadow-2xl"
                            style={{
                                width: size,
                                height: size,
                                background: cover.background,
                                transform: `translateX(${tx}px) rotateY(${rotY}deg) scale(${scale})`,
                                opacity,
                                zIndex: Math.round(100 - abs),
                            }}
                        >
                            {/* Vinyl-ring motif */}
                            <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                                <div className="h-2/3 w-2/3 rounded-full bg-white/20" />
                                <div className="absolute h-1/2 w-1/2 rounded-full bg-white/10" />
                                <div className="absolute h-1/6 w-1/6 rounded-full bg-white/40" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
