import { auth } from '$lib/auth';
import { clearUserCache } from '$lib/../hooks.server';
import { uploadProfilePicture, uploadBannerImage } from '$lib/server/s3';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { MAX_FILE_SIZE } from '$lib/data/constants';
import { isNameAppropriate } from '$lib/server/moderation';

async function validateInputs(name: string, bio: string, username: string, avatarFile: File | null, portfolioTheme?: string, avatarDecoration?: string, bannerFile?: File | null) {
    if (!name || !name.trim()) {
        throw error(400, 'Display name is required');
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
        throw error(400, 'Display name must be at least 2 characters');
    }

    if (trimmedName.length > 50) {
        throw error(400, 'Display name must be 50 characters or less');
    }

    if (!(await isNameAppropriate(trimmedName))) {
        throw error(400, 'Name contains inappropriate content');
    }

    if (bio && bio.length > 160) {
        throw error(400, 'Bio must be 160 characters or less');
    }

    if (username && (username.length < 3 || username.length > 30)) {
        throw error(400, 'Username must be between 3 and 30 characters');
    }

    if (username) {
        const alphanumericRegex = /^[a-z0-9_]+$/;
        if (!alphanumericRegex.test(username)) {
            throw error(400, 'Username must contain only lowercase letters, numbers, and underscores');
        }

        const purelyNumericRegex = /^\d+$/;
        if (purelyNumericRegex.test(username)) {
            throw error(400, 'Username cannot be purely numeric');
        }
    }

    if (username && !(await isNameAppropriate(username))) {
        throw error(400, 'Username contains inappropriate content');
    }

    if (bio && !(await isNameAppropriate(bio))) {
        throw error(400, 'Bio contains inappropriate content');
    }

    if (avatarFile && avatarFile.size > MAX_FILE_SIZE) {
        throw error(400, 'Avatar file must be smaller than 1MB');
    }
    	if (portfolioTheme && !/^([a-z0-9_-]{1,20})$/i.test(portfolioTheme)) {
		throw error(400, 'Invalid theme value');
	}

	if (avatarDecoration && !/^([a-z0-9_-]{1,20})$/i.test(avatarDecoration)) {
		throw error(400, 'Invalid decoration value');
	}
    if (bannerFile && bannerFile.size > MAX_FILE_SIZE * 5) {
        throw error(400, 'Banner image must be smaller than 5MB');
    }
}

export async function POST({ request }) {
    const session = await auth.api.getSession({
        headers: request.headers
    });

    if (!session?.user) {
        throw error(401, 'Not authenticated');
    }

    const formData = await request.formData();

    let name = (formData.get('name') as string)?.trim();
    const bio = formData.get('bio') as string;
    const username = (formData.get('username') as string)?.toLowerCase().trim();
    const avatarFile = formData.get('avatar') as File | null;
    const bannerFile = formData.get('banner') as File | null;
    const removeBanner = formData.get('removeBanner') as string | null;
    const portfolioTheme = (formData.get('portfolioTheme') as string) || undefined;
    const avatarDecoration = (formData.get('avatarDecoration') as string) || undefined;

    name = name?.trim().replace(/\s+/g, ' ');

    await validateInputs(name, bio, username, avatarFile, portfolioTheme, avatarDecoration, bannerFile);

    const updates: Record<string, any> = {
        name,
        bio,
        username,
        updatedAt: new Date()
    };
    if (portfolioTheme) updates.portfolioTheme = portfolioTheme;
    if (avatarDecoration !== undefined) updates.avatarDecoration = avatarDecoration;

    if (avatarFile && avatarFile.size > 0) {
        try {
            const arrayBuffer = await avatarFile.arrayBuffer();
            const key = await uploadProfilePicture(
                session.user.id,
                new Uint8Array(arrayBuffer),
                avatarFile.type
            );
            updates.image = key;
        } catch (e) {
            console.error('Avatar upload failed, continuing without update:', e);
        }
    }

    if (removeBanner === '1') {
        updates.bannerImage = null;
    } else if (bannerFile && bannerFile.size > 0) {
        try {
            const arrayBuffer = await bannerFile.arrayBuffer();
            const key = await uploadBannerImage(
                session.user.id,
                new Uint8Array(arrayBuffer),
                bannerFile.type
            );
            updates.bannerImage = key;
        } catch (e) {
            console.error('Banner upload failed, continuing without update:', e);
        }
    }

    await db.update(user)
        .set(updates)
        .where(eq(user.id, Number(session.user.id)));

    // Invalidate session cache so fresh user data (including image) is returned on next load
    try { clearUserCache(session.user.id) } catch {}

    return json({ success: true });
}
