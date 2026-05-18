# Image Budget

Guidelines for contributors adding images to Earthropy.

## Size limits per use case

| Use case | Max file size | Notes |
|---|---|---|
| User avatar | 100 KB | Square crop; rendered at 40–96 px |
| Group cover | 200 KB | 16:9 or 3:1 banner; rendered at full container width |
| Hero / marketing | 300 KB | Above-the-fold; use `priority` on the `<Image>` component |
| Post attachment | 500 KB | Below-the-fold; lazy loaded by default |
| SDG icon / badge | 20 KB | Small decorative; prefer SVG when possible |

## Formats

- **WebP** — preferred for photos and complex illustrations. Good compression, wide support.
- **AVIF** — preferred where supported; better compression than WebP. Next.js serves AVIF automatically when `image/avif` is in `next.config.ts` `images.formats`.
- **SVG** — use for icons, logos, and flat graphics. Not processed by Next.js Image; include `aria-hidden` or `aria-label` as appropriate.
- **PNG** — fallback for images that require lossless encoding (screenshots, transparent backgrounds).
- **JPEG** — acceptable for photos when WebP/AVIF source is unavailable.

Next.js Image optimization automatically converts source images to WebP or AVIF at request time when the client supports it.

## Using Next.js `<Image>`

Always use `next/image` instead of a bare `<img>` for raster images:

```tsx
import Image from 'next/image';

// Above-the-fold (hero, first visible avatar)
<Image src="/hero.webp" alt="..." width={1200} height={600} priority />

// Below-the-fold (post attachments, group covers below scroll)
<Image src="/cover.webp" alt="..." width={800} height={450} />
// loading="lazy" is the default — no need to set it explicitly
```

- **Always** provide `width` and `height` (or `fill`) to prevent layout shift (CLS).
- **Always** provide a meaningful `alt`. Empty `alt=""` is only valid for decorative images.
- Use `priority` only for the single largest above-the-fold image per page. Do not use it on images below the fold.
- Use `fill` + a sized container when the intrinsic dimensions are unknown (e.g. user-uploaded images).

## Next.js Image config (`apps/app/next.config.ts`)

```ts
images: {
  formats: ['image/avif', 'image/webp'],   // serve AVIF first, WebP fallback
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256],
}
```

Add external domains to `remotePatterns` only when user-uploaded or externally hosted images are introduced. Keep the list minimal and as specific as possible (protocol + hostname + pathname prefix).

## Remote images

If you add support for user-uploaded images via MinIO or an external CDN, add the domain to `remotePatterns` in `apps/app/next.config.ts`:

```ts
remotePatterns: [
  {
    protocol: 'https',
    hostname: 'your-cdn.example.com',
    pathname: '/uploads/**',
  },
],
```

Do not use wildcard hostnames (`**`) in production.
