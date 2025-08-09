import { createClient } from '@supabase/supabase-js';
import { processImage } from './image.js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { db } from './db';
import { user } from './db/schema';
import { eq } from 'drizzle-orm';

const supabase = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_SERVICE_ROLE_KEY);
const BUCKET_NAME = 'bucket';

async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
    let lastError: unknown
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn()
        } catch (e) {
            lastError = e
            const delay = baseDelayMs * Math.pow(2, i) + Math.floor(Math.random() * 250)
            await sleep(delay)
        }
    }
    throw lastError
}

async function uploadViaHttpFallback(key: string, body: Uint8Array, contentType: string): Promise<string> {
    const url = `${PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${key}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PRIVATE_SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': contentType,
                'x-upsert': 'true'
            },
            body,
            signal: controller.signal
        })
        if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`HTTP fallback upload failed: ${res.status} ${res.statusText} ${text}`)
        }
        // Supabase returns 200/201 and Location header like /object/bucket/key
        return key
    } finally {
        clearTimeout(timeoutId)
    }
}

export async function generatePresignedUrl(key: string, _contentType: string): Promise<string> {
    const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .createSignedUrl(key, 3600); // 1 hour expiration

    if (error) {
        console.error('Error generating signed URL:', error);
        throw error;
    }
    return data.signedUrl;
}

export async function deleteObject(key: string): Promise<void> {
    const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .remove([key]);

    if (error) {
        console.error('Error deleting object:', error);
        throw error;
    }
}

export async function generateDownloadUrl(key: string): Promise<string> {
    const { data } = supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(key);
    
    return data.publicUrl;
}

export async function uploadProfilePicture(
    identifier: string,
    body: Uint8Array,
    contentType: string,
): Promise<string> {
    if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Invalid file type. Only images are allowed.');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(contentType.toLowerCase())) {
        throw new Error('Unsupported image format. Only JPEG, PNG, GIF, and WebP are allowed.');
    }

    const processedImage = await processImage(Buffer.from(body));
    
    const key = `avatars/${identifier}.webp`;

    let uploadedPath: string | null = null
    try {
        const data = await withRetry(async () => {
            const { data, error } = await supabase
                .storage
                .from(BUCKET_NAME)
                .upload(key, processedImage.buffer, {
                    contentType: processedImage.contentType,
                    upsert: true
                })
            if (error) throw error
            return data
        }, 3, 700)
        uploadedPath = data.path
    } catch (primaryError) {
        console.warn('Primary Supabase upload failed, trying HTTP fallback...', primaryError)
        // Try HTTP fallback once
        uploadedPath = await uploadViaHttpFallback(key, processedImage.buffer, processedImage.contentType)
    }

    await db.update(user).set({ image: uploadedPath }).where(eq(user.id, parseInt(identifier)));

    console.log(`Updated user ${identifier} with new image key: ${uploadedPath}`);

    return uploadedPath;
}

export async function uploadCoinIcon(
    coinSymbol: string,
    body: Uint8Array,
    contentType: string,
): Promise<string> {
    if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Invalid file type. Only images are allowed.');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(contentType.toLowerCase())) {
        throw new Error('Unsupported image format. Only JPEG, PNG, GIF, and WebP are allowed.');
    }

    const processedImage = await processImage(Buffer.from(body));

    const key = `coins/${coinSymbol.toLowerCase()}.webp`;

    const { data, error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(key, processedImage.buffer, {
            contentType: processedImage.contentType,
            upsert: true
        });

    if (error) {
        console.error('Error uploading coin icon:', error);
        throw error;
    }
    return data.path;
}