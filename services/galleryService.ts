
import { getSupabaseClient } from './supabaseClient';
import { GalleryImage } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { SUPABASE_CONFIG } from './config';

interface SaveGalleryImageMetadata {
    prompt: string | null;
    negative_prompt: string | null;
    aspect_ratio: string | null;
}

export const saveToGallery = async (metadata: SaveGalleryImageMetadata, imageBlob: Blob): Promise<GalleryImage> => {
    const supabase = getSupabaseClient();
    try {
        const fileExtension = imageBlob.type.split('/')[1] || 'jpg';
        const fileName = `${uuidv4()}.${fileExtension}`;
        const filePath = `${fileName}`;

        // 1. Upload the image to Supabase Storage in the dedicated gallery bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(SUPABASE_CONFIG.GALLERY_BUCKET)
            .upload(filePath, imageBlob, {
                cacheControl: '3600',
                upsert: false,
                contentType: imageBlob.type,
            });

        if (uploadError) {
            console.error("Supabase storage upload error:", uploadError);
            let msg = uploadError.message;
            if (msg.includes('row-level security') || msg.includes('violates row-level security')) {
                msg = `Permission Denied: Check policies for storage bucket '${SUPABASE_CONFIG.GALLERY_BUCKET}'.`;
            }
            throw new Error(`Failed to upload image to storage: ${msg}`);
        }

        if (!uploadData) {
            throw new Error("Upload succeeded but no data was returned from storage.");
        }

        // 2. Get the public URL of the uploaded image from the gallery bucket
        const { data: urlData } = supabase.storage
            .from(SUPABASE_CONFIG.GALLERY_BUCKET)
            .getPublicUrl(uploadData.path);
        
        const imageUrl = urlData.publicUrl;

        if (!imageUrl) {
            throw new Error("Could not retrieve public URL for the uploaded image.");
        }

        // 3. Insert metadata into the gallery table
        const { data: dbData, error: dbError } = await supabase
            .from(SUPABASE_CONFIG.GALLERY_TABLE)
            .insert({
                ...metadata,
                image_url: imageUrl,
            })
            .select()
            .single();

        if (dbError) {
            console.error("Supabase DB insert error:", dbError);
            // Attempt to clean up storage if DB insert fails
            await supabase.storage.from(SUPABASE_CONFIG.GALLERY_BUCKET).remove([filePath]);
            
            let msg = dbError.message;
            if (msg.includes('row-level security')) {
                msg = `Permission Denied: Check RLS policies for table '${SUPABASE_CONFIG.GALLERY_TABLE}'.`;
            }
            throw new Error(`Failed to save image metadata to database: ${msg}`);
        }
        
        if (!dbData) {
             throw new Error("DB insert succeeded but no data was returned.");
        }

        return dbData as GalleryImage;

    } catch (error) {
        console.error("Error in saveToGallery:", error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("An unknown error occurred while saving to the gallery.");
    }
};

export const fetchGalleryImages = async (page: number, limit: number): Promise<GalleryImage[]> => {
    const supabase = getSupabaseClient();
    try {
        const { data, error } = await supabase
            .from(SUPABASE_CONFIG.GALLERY_TABLE)
            .select('*')
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (error) {
            throw new Error(error.message);
        }

        return data || [];
    } catch (error) {
        console.error("Error fetching gallery images:", error);
        return [];
    }
};

export const deleteGalleryImage = async (id: number, imageUrl: string): Promise<void> => {
    const supabase = getSupabaseClient();
    try {
        const bucketName = SUPABASE_CONFIG.GALLERY_BUCKET;
        const url = new URL(imageUrl);
        const pathPrefix = `/storage/v1/object/public/${bucketName}/`;
        let path = '';

        if (url.pathname.startsWith(pathPrefix)) {
            path = decodeURIComponent(url.pathname.substring(pathPrefix.length));
        } else {
             // Fallback for different URL structures
             path = decodeURIComponent(url.pathname.split(`/${bucketName}/`)[1]);
        }
        
        if (!path) {
            throw new Error("Could not determine file path from URL.");
        }

        // 1. Delete from storage
        const { error: storageError } = await supabase.storage
            .from(bucketName)
            .remove([path]);
        
        if (storageError) {
            // Log error but don't throw, so we can still attempt DB deletion
            console.error("Error deleting from storage, will still attempt DB deletion:", storageError.message);
        }

        // 2. Delete from database
        const { error: dbError } = await supabase
            .from(SUPABASE_CONFIG.GALLERY_TABLE)
            .delete()
            .match({ id });

        if (dbError) {
            throw new Error(dbError.message);
        }
    } catch (error) {
        console.error("Error deleting gallery image:", error);
        if (error instanceof Error) {
            throw error;
        }
    }
};
