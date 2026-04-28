import React, { useState } from 'react';
import { Edit3, Globe2, Play, Plus, Radio, Save, Trash2, X } from 'lucide-react';
import { useStore } from '../context/Store';
import { IRadioStation } from '../types';

const emptyForm = {
    name: '',
    streamUrl: '',
    homepageUrl: '',
    genre: '',
    imageUrl: '',
};

export const InternetRadioView: React.FC = () => {
    const {
        radioStations,
        currentRadioStation,
        isRadioPlaying,
        playRadioStation,
        toggleRadioPlay,
        addRadioStation,
        updateRadioStation,
        deleteRadioStation,
    } = useStore();

    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId(null);
    };

    const submitStation = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.streamUrl.trim()) return;

        const payload = {
            name: form.name.trim(),
            streamUrl: form.streamUrl.trim(),
            homepageUrl: form.homepageUrl.trim() || undefined,
            genre: form.genre.trim() || undefined,
            imageUrl: form.imageUrl.trim() || undefined,
        };

        if (editingId) {
            const existing = radioStations.find(station => station.id === editingId);
            if (existing) updateRadioStation({ ...existing, ...payload });
        } else {
            addRadioStation(payload);
        }

        resetForm();
    };

    const editStation = (station: IRadioStation) => {
        setEditingId(station.id);
        setForm({
            name: station.name,
            streamUrl: station.streamUrl,
            homepageUrl: station.homepageUrl || '',
            genre: station.genre || '',
            imageUrl: station.imageUrl || '',
        });
    };

    return (
        <div className="p-6 md:p-8 pb-32 max-w-[1500px] mx-auto">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
                        <Radio className="h-4 w-4" />
                        Internet Radio
                    </div>
                    <h1 className="text-3xl font-black text-neutral-900 dark:text-white">Radio Stations</h1>
                    <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-white/60">
                        Add direct MP3, AAC, OGG, or playlist stream URLs from internet radio stations.
                    </p>
                </div>
            </div>

            <form
                onSubmit={submitStation}
                className="mb-8 rounded-lg border border-neutral-200 bg-white/80 p-4 dark:border-white/10 dark:bg-neutral-900/70"
            >
                <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr_1fr_1fr]">
                    <input
                        value={form.name}
                        onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Station name"
                        className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-primary/50 dark:border-white/10 dark:bg-neutral-950 dark:text-white"
                    />
                    <input
                        value={form.streamUrl}
                        onChange={(e) => setForm(prev => ({ ...prev, streamUrl: e.target.value }))}
                        placeholder="Stream URL"
                        className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-primary/50 dark:border-white/10 dark:bg-neutral-950 dark:text-white"
                    />
                    <input
                        value={form.genre}
                        onChange={(e) => setForm(prev => ({ ...prev, genre: e.target.value }))}
                        placeholder="Genre"
                        className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-primary/50 dark:border-white/10 dark:bg-neutral-950 dark:text-white"
                    />
                    <input
                        value={form.imageUrl}
                        onChange={(e) => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                        placeholder="Logo URL"
                        className="rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-primary/50 dark:border-white/10 dark:bg-neutral-950 dark:text-white"
                    />
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                        value={form.homepageUrl}
                        onChange={(e) => setForm(prev => ({ ...prev, homepageUrl: e.target.value }))}
                        placeholder="Homepage URL"
                        className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-primary/50 dark:border-white/10 dark:bg-neutral-950 dark:text-white"
                    />
                    <div className="flex gap-2">
                        {editingId && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-200 px-4 py-2 text-sm font-bold text-neutral-900 transition hover:bg-neutral-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                            >
                                <X className="h-4 w-4" />
                                Cancel
                            </button>
                        )}
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-primary dark:hover:text-white"
                        >
                            {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            {editingId ? 'Save Station' : 'Add Station'}
                        </button>
                    </div>
                </div>
            </form>

            {radioStations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-white/15">
                    <Radio className="mx-auto mb-4 h-12 w-12 text-neutral-400 dark:text-white/30" />
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">No stations yet</h2>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-white/60">Add a station stream URL to start listening.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {radioStations.map((station) => {
                        const isCurrent = currentRadioStation?.id === station.id;
                        return (
                            <div
                                key={station.id}
                                className={`rounded-lg border bg-neutral-100 p-4 transition dark:bg-neutral-900/70 ${isCurrent
                                    ? 'border-primary/60 shadow-[0_0_24px_rgba(var(--primary-rgb),0.18)]'
                                    : 'border-neutral-200 hover:border-neutral-300 dark:border-white/10 dark:hover:border-white/20'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-200 dark:bg-white/10">
                                        {station.imageUrl ? (
                                            <img src={station.imageUrl} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <Radio className="h-7 w-7 text-primary" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate text-base font-bold text-neutral-900 dark:text-white">{station.name}</h3>
                                        <p className="mt-1 truncate text-xs text-neutral-600 dark:text-white/60">{station.genre || 'Internet radio'}</p>
                                        <p className="mt-2 truncate text-[11px] font-mono text-neutral-500 dark:text-white/40">{station.streamUrl}</p>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between gap-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => isCurrent ? toggleRadioPlay() : playRadioStation(station)}
                                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-black transition hover:brightness-110"
                                        >
                                            <Play className="h-3.5 w-3.5 fill-current" />
                                            {isCurrent && isRadioPlaying ? 'Pause' : 'Play'}
                                        </button>
                                        {station.homepageUrl && (
                                            <a
                                                href={station.homepageUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 rounded-lg bg-neutral-200 px-3 py-2 text-xs font-bold text-neutral-900 transition hover:bg-neutral-300 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                            >
                                                <Globe2 className="h-3.5 w-3.5" />
                                                Site
                                            </a>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => editStation(station)}
                                            className="rounded-lg p-2 text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                                            aria-label="Edit station"
                                        >
                                            <Edit3 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteRadioStation(station.id)}
                                            className="rounded-lg p-2 text-red-500 transition hover:bg-red-500/10"
                                            aria-label="Delete station"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
