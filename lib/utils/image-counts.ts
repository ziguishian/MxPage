// Shared by configuration, API validation, saved projects and Agent tool schemas.
export const HERO_MIN = 3;
export const HERO_MAX = 10;
export const DETAIL_MIN = 4;
export const DETAIL_MAX = 20;
export const TOTAL_IMAGE_MAX = HERO_MAX + DETAIL_MAX;
export const heroCountOptions = Array.from({ length: HERO_MAX - HERO_MIN + 1 }, (_, i) => HERO_MIN + i);
export const detailCountOptions = Array.from({ length: DETAIL_MAX - DETAIL_MIN + 1 }, (_, i) => DETAIL_MIN + i);
