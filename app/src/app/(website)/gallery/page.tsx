import { GalleryLightbox } from "@/components/website/GalleryLightbox";

const images = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1589561084283-930aa7b1ce50?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1605540436563-5bca919ae766?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1535007726788-e8ad31ffb28f?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1544551763-7ef42075d4e2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=1200&q=80",
];

export default function GalleryPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">Gallery</h1>
        <p className="text-[var(--color-text-muted)]">A quick look at rides, zones and guest experiences.</p>
      </div>
      <GalleryLightbox images={images} />
    </div>
  );
}
