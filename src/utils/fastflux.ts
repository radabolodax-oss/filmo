const DIACRITICS_RANGE = /[̀-ͯ]/g;

export function buildFastfluxUrl(
  title: string,
  season: number,
  episode: number,
  lang: 'VF' | 'VOSTFR' = 'VF'
): string {
  const cleaned = title
    .normalize('NFD')
    .replace(DIACRITICS_RANGE, '')
    .replace(/[''']/g, ' ')
    .replace(/[:",!?()&]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter(Boolean);
  const folder = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
  const slug = words.map(w => w.toLowerCase()).join('-');

  const s = `S${String(season).padStart(2, '0')}`;
  const e = `E${String(episode).padStart(2, '0')}`;
  const file = `/series/${lang}/${folder}/${s}/${slug}-${s}-${e}.mp4`;

  return `https://fastflux.xyz/api/video_proxy.php?file=${file}`;
}

export function toAnicloudSlug(title: string): string {
  return title
    .normalize('NFD')
    .replace(DIACRITICS_RANGE, '')
    .toLowerCase()
    .replace(/[:'",!?()&]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .trim();
}
