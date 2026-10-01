export type ListingPhoto={source_url:string;status:string};

export function safePhoto(url:string):boolean {
    try {
        const parsed=new URL(url);
        return parsed.protocol==='https:' && !parsed.username && !parsed.password && (!parsed.port || parsed.port==='443') &&
            (parsed.hostname==='ebayimg.com' || parsed.hostname.endsWith('.ebayimg.com'));
    } catch {return false}
}

export function availablePhotos(photos:ListingPhoto[]):ListingPhoto[] {
    const seen=new Set<string>();
    return photos.filter(photo=>{
        if(!safePhoto(photo.source_url) || seen.has(photo.source_url))return false;
        seen.add(photo.source_url);return true;
    });
}
