
/**
 * PRECISION RESOLUTION ENGINE
 * Handles center-weighted cropping and resizing to exact pixel dimensions.
 */

export interface ImageDimensions {
    width: number;
    height: number;
}

/**
 * Parses aspect ratio strings like '1920x600' or '16:9' into dimensions.
 */
export const parseRatioToDimensions = (ratio: string): ImageDimensions => {
    if (ratio.includes('x')) {
        const [w, h] = ratio.split('x').map(Number);
        return { width: w, height: h };
    }
    const [rw, rh] = ratio.split(':').map(Number);
    const base = 1600;
    return { width: base, height: Math.round(base * (rh / rw)) };
};

/**
 * Performs a center-weighted "Cover" crop and STRICT UPSCALE to target dimensions.
 */
export const applyPrecisionCrop = async (
    source: string | File, 
    targetWidth: number, 
    targetHeight: number,
    outputType: 'image/webp' | 'image/jpeg' = 'image/jpeg',
    quality: number = 0.90
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        const process = () => {
            const canvas = document.createElement('canvas');
            // If targetWidth is 0 (Original mode), use image's own size
            const finalW = targetWidth || img.width;
            const finalH = targetHeight || img.height;

            canvas.width = finalW;
            canvas.height = finalH;

            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return reject(new Error('Canvas context failed'));

            // COVER CROP LOGIC
            const sourceAspect = img.width / img.height;
            const targetAspect = finalW / finalH;

            let sx, sy, sWidth, sHeight;

            if (sourceAspect > targetAspect) {
                // Source is wider than target
                sHeight = img.height;
                sWidth = img.height * targetAspect;
                sx = (img.width - sWidth) / 2;
                sy = 0;
            } else {
                // Source is taller than target
                sWidth = img.width;
                sHeight = img.width / targetAspect;
                sx = 0;
                // For ultra-wide aspect ratio targets (like 1920x600, 1600x533),
                // the main focus subjects (desks, computers, folders, keys, products) are naturally 
                // situated on tables or surfaces in the lower portion of the frame. 
                // We bias the vertical crop slightly downwards (0.65 instead of 0.5) to keep them visible.
                const bias = targetAspect >= 2.5 ? 0.65 : 0.5;
                sy = (img.height - sHeight) * bias;
            }

            // High-fidelity transform
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // This drawImage call handles the scale-up to 1920px automatically
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, finalW, finalH);
            
            resolve(canvas.toDataURL(outputType, quality));
        };

        if (typeof source === 'string') {
            img.src = source;
            img.onload = process;
            img.onerror = reject;
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target?.result as string;
                img.onload = process;
                img.onerror = reject;
            };
            reader.readAsDataURL(source);
            reader.onerror = reject;
        }
    });
};

/**
 * Converts any image blob (e.g. WebP) to a high-quality JPEG blob.
 */
export const convertBlobToJpg = async (blob: Blob, quality: number = 0.90): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                return reject(new Error('Canvas context failed'));
            }
            
            // Draw image on canvas
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((jpgBlob) => {
                URL.revokeObjectURL(url);
                if (jpgBlob) {
                    resolve(jpgBlob);
                } else {
                    reject(new Error('Blob conversion failed'));
                }
            }, 'image/jpeg', quality);
        };
        
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
        
        img.src = url;
    });
};

