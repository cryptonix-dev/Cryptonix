import { createClient } from '@supabase/supabase-js';
import { processImage } from './image.js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Assuming PUBLIC_B2_BUCKET will be used as the Supabase Storage bucket name
// from the .env file. If the user wants a different bucket, they need to specify.
import { PUBLIC_B2_BUCKET } from '$env/static/public';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
const SUPABASE_STORAGE_BUCKET = PUBLIC_B2_BUCKET; // Using the existing env var for bucket name

export async function generatePresignedUrl(key: string, _contentType: string): Promise<string> {
    const { data, error } = await supabase
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
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
        .from(SUPABASE_STORAGE_BUCKET)
        .remove([key]);

    if (error) {
        console.error('Error deleting object:', error);
        throw error;
    }
}

export async function generateDownloadUrl(key: string): Promise<string> {
    const { data } = supabase
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(key);
    
    // Supabase getPublicUrl returns an object with `publicUrl` property
    return data.publicUrl;
}

export async function uploadProfilePicture(
    identifier: string, // Can be user ID or a unique ID from social provider
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

    const { data, error } = await supabase
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(key, processedImage.buffer, {
            contentType: processedImage.contentType,
            upsert: true // Overwrite if file exists
        });

    if (error) {
        console.error('Error uploading profile picture:', error);
        throw error;
    }
    return data.path; // Supabase returns the path of the uploaded file
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
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(key, processedImage.buffer, {
            contentType: processedImage.contentType,
            upsert: true // Overwrite if file exists
        });

    if (error) {
        console.error('Error uploading coin icon:', error);
        throw error;
    }
    return data.path; // Supabase returns the path of the uploaded file
}