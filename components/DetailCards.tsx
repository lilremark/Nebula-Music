import React from 'react';
import { Mic2, Play } from 'lucide-react';

// Card language shared by the detail and search views. It mirrors the Library
// Albums/Artists grid (square or round art, title, one muted line) so every
// collection of albums or artists in the app reads the same way.

export const COLLECTION_GRID_CLASS = 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 content-start';

interface AlbumCardProps {
    title: string;
    subtitle?: React.ReactNode;
    imageUrl: string;
    onOpen: () => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ title, subtitle, imageUrl, onOpen }) => (
    <button type="button" data-nebula-collection-card className="nebula-media-card group" onClick={onOpen}>
        <div className="nebula-media-card-art relative aspect-square overflow-hidden mb-3 rounded-xl bg-neutral-200 dark:bg-neutral-900">
            <img src={imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                <div className="w-12 h-12 bg-white text-black rounded-lg shadow-xl flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"><Play className="w-5 h-5 fill-current ml-0.5" /></div>
            </div>
        </div>
        <h3 className="nebula-media-card-title" title={title}>{title}</h3>
        {subtitle && <p className="nebula-media-card-subtitle">{subtitle}</p>}
    </button>
);

interface ArtistCardProps {
    name: string;
    subtitle?: React.ReactNode;
    imageUrl?: string;
    onOpen: () => void;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ name, subtitle, imageUrl, onOpen }) => (
    <button type="button" data-nebula-artist-card className="nebula-media-card nebula-media-card-round group" onClick={onOpen}>
        <div className="nebula-media-card-art relative aspect-square overflow-hidden mb-3 rounded-full bg-neutral-200 dark:bg-neutral-900">
            {imageUrl
                ? <img src={imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                : <div className="w-full h-full grid place-items-center text-neutral-400 dark:text-white/40"><Mic2 className="w-10 h-10" /></div>}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                <span className="px-3 py-1.5 bg-white text-black rounded text-[10px] font-bold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">View</span>
            </div>
        </div>
        <h3 className="nebula-media-card-title" title={name}>{name}</h3>
        {subtitle && <p className="nebula-media-card-subtitle">{subtitle}</p>}
    </button>
);
