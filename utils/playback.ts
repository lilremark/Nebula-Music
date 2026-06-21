import type { ISong } from '../types';

export const containsSameSongs = (left: ISong[], right: ISong[]): boolean => {
    if (left.length !== right.length) return false;

    const leftIds = left.map(song => song.id).sort();
    const rightIds = right.map(song => song.id).sort();

    return leftIds.every((id, index) => id === rightIds[index]);
};
