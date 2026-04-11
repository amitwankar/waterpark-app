"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface GalleryLightboxProps {
  images: string[];
}

export function GalleryLightbox({ images }: GalleryLightboxProps): JSX.Element {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]"
            onClick={() => setActiveIndex(index)}
          >
            <img
              src={src}
              alt={`AquaWorld gallery ${index + 1}`}
              className="h-56 w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {activeIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={images[activeIndex]}
            alt={`AquaWorld preview ${activeIndex + 1}`}
            className="max-h-[90vh] w-auto max-w-[96vw] rounded-[var(--radius-lg)] object-contain"
          />
        </div>
      ) : null}
    </>
  );
}
