'use client';

import { useEffect, useRef, useState } from 'react';
import { XIcon } from 'lucide-react';

import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';

interface LightboxState {
  images: string[];
  startIndex: number;
}

export function ArticleBody({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;
    setCurrentIndex(carouselApi.selectedScrollSnap());
    carouselApi.on('select', () => setCurrentIndex(carouselApi.selectedScrollSnap()));
  }, [carouselApi]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG') return;
    const allImgs = Array.from(containerRef.current?.querySelectorAll('img') ?? []);
    const startIndex = allImgs.indexOf(target as HTMLImageElement);
    const images = allImgs.map((img) => (img as HTMLImageElement).src);
    setCurrentIndex(startIndex);
    setLightbox({ images, startIndex });
  }

  function close() {
    setLightbox(null);
    setCarouselApi(undefined);
  }

  return (
    <>
      <div
        ref={containerRef}
        className="article-html [&_img]:cursor-pointer"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleClick}
      />

      <DialogPrimitive.Root open={!!lightbox} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogPortal>
          <DialogOverlay className="bg-black/85 backdrop-blur-sm" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
            {/* Close button */}
            <button
              onClick={close}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
              aria-label="Close image viewer"
            >
              <XIcon className="h-5 w-5" />
            </button>

            {lightbox && (
              <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl">
                <Carousel
                  setApi={setCarouselApi}
                  opts={{ startIndex: lightbox.startIndex, loop: lightbox.images.length > 1 }}
                  className="w-full"
                >
                  <CarouselContent>
                    {lightbox.images.map((src, i) => (
                      <CarouselItem key={i} className="flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Image ${i + 1} of ${lightbox.images.length}`}
                          className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>

                  {lightbox.images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-2 border-white/20 bg-black/50 text-white hover:bg-black/70 hover:text-white" />
                      <CarouselNext className="right-2 border-white/20 bg-black/50 text-white hover:bg-black/70 hover:text-white" />
                    </>
                  )}
                </Carousel>

                {lightbox.images.length > 1 && (
                  <p className="mt-3 text-center font-mono text-xs text-white/50">
                    {currentIndex + 1} / {lightbox.images.length}
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogPortal>
      </DialogPrimitive.Root>
    </>
  );
}
