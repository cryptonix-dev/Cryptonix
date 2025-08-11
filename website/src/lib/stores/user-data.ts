import { writable } from 'svelte/store';

export type User = {
    id: string;
    name: string;
    username: string;
    email: string;
    isAdmin: boolean;
    image: string;
    isBanned: boolean;
    banReason: string | null;
    avatarUrl: string | null;

    baseCurrencyBalance: number;
    bio: string;

    volumeMaster: number;
    volumeMuted: boolean;

    prestigeLevel: number;
    	portfolioTheme?: string;
	avatarDecoration?: string;
    bannerImage?: string | null;
} | null;

export const USER_DATA = writable<User>(undefined);