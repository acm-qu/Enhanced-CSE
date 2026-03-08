'use client';

import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
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

interface InlineImage {
  src: string;
  alt: string;
  srcSet?: string;
  title?: string;
  caption?: string;
}

interface InlineCarouselMount {
  root: Root;
  mountNode: HTMLDivElement;
  sourceNodes: HTMLElement[];
}

const STACK_IMAGE_WRAPPER_TAGS = new Set(['IMG', 'P', 'FIGURE', 'DIV', 'A']);

function toInlineImage(image: HTMLImageElement): InlineImage {
  const figure = image.closest('figure');
  const caption = figure?.querySelector('figcaption')?.textContent?.trim() || undefined;

  return {
    src: image.src,
    alt: image.alt ?? '',
    srcSet: image.srcset || undefined,
    title: image.title || undefined,
    caption
  };
}

function extractInlineImages(node: Element): InlineImage[] | null {
  const htmlNode = node as HTMLElement;

  if (htmlNode.dataset.inlineCarouselMount === 'true' || htmlNode.dataset.inlineCarouselSource === 'true' || htmlNode.hidden) {
    return null;
  }

  const tagName = node.tagName.toUpperCase();
  if (!STACK_IMAGE_WRAPPER_TAGS.has(tagName)) {
    return null;
  }

  if (node.querySelector('iframe,video,table,pre,blockquote,ul,ol')) {
    return null;
  }

  const images = tagName === 'IMG' ? [node as HTMLImageElement] : Array.from(node.querySelectorAll('img'));
  if (images.length < 1) {
    return null;
  }

  if (images.some((image) => !image.src)) {
    return null;
  }

  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('figcaption').forEach((element) => {
    element.remove();
  });

  clone.querySelectorAll('img, picture, source, br').forEach((element) => {
    element.remove();
  });

  if ((clone.textContent ?? '').trim()) {
    return null;
  }

  return images.map((image) => toInlineImage(image));
}

function isMeaningfulTextNode(node: ChildNode): boolean {
  return node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim());
}

function mountInlineCarouselForImageStacks(container: Element, mounts: InlineCarouselMount[]) {
  const nodes = Array.from(container.childNodes);

  let index = 0;
  while (index < nodes.length) {
    const currentNode = nodes[index];

    if (!(currentNode instanceof HTMLElement)) {
      index += 1;
      continue;
    }

    const firstImages = extractInlineImages(currentNode);

    if (!firstImages) {
      if (currentNode.children.length > 0) {
        mountInlineCarouselForImageStacks(currentNode, mounts);
      }
      index += 1;
      continue;
    }

    const groupNodes: HTMLElement[] = [currentNode];
    const groupImages: InlineImage[] = [...firstImages];

    let nextIndex = index + 1;
    while (nextIndex < nodes.length) {
      const nextNode = nodes[nextIndex];

      if (isMeaningfulTextNode(nextNode)) {
        break;
      }

      if (!(nextNode instanceof HTMLElement)) {
        nextIndex += 1;
        continue;
      }

      const nextImages = extractInlineImages(nextNode);
      if (!nextImages) {
        break;
      }

      groupNodes.push(nextNode);
      groupImages.push(...nextImages);
      nextIndex += 1;
    }

    if (groupImages.length >= 2) {
      const mountNode = document.createElement('div');
      mountNode.dataset.inlineCarouselMount = 'true';
      groupNodes[0].before(mountNode);

      groupNodes.forEach((node) => {
        node.dataset.inlineCarouselSource = 'true';
        node.hidden = true;
      });

      const root = createRoot(mountNode);
      root.render(<InlineImageCarousel images={groupImages} />);
      mounts.push({ root, mountNode, sourceNodes: groupNodes });
    }

    index = nextIndex;
  }
}

function InlineImageCarousel({ images }: { images: InlineImage[] }) {
  const [inlineCarouselApi, setInlineCarouselApi] = useState<CarouselApi>();
  const [inlineIndex, setInlineIndex] = useState(0);

  useEffect(() => {
    if (!inlineCarouselApi) return;

    const onSelect = () => {
      setInlineIndex(inlineCarouselApi.selectedScrollSnap());
    };

    onSelect();
    inlineCarouselApi.on('select', onSelect);

    return () => {
      inlineCarouselApi.off('select', onSelect);
    };
  }, [inlineCarouselApi]);

  const activeImage = images[inlineIndex];

  return (
    <div className="my-6" data-inline-carousel>
      <Carousel setApi={setInlineCarouselApi} opts={{ loop: images.length > 1 }} className="w-full">
        <CarouselContent>
          {images.map((image, index) => (
            <CarouselItem key={`${image.src}-${index}`} className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                srcSet={image.srcSet}
                alt={image.alt || `Image ${index + 1}`}
                title={image.title}
                className="h-auto max-h-[70vh] w-auto max-w-full rounded-md border border-foreground/10 object-contain"
              />
            </CarouselItem>
          ))}
        </CarouselContent>

        {images.length > 1 ? (
          <>
            <CarouselPrevious />
            <CarouselNext />
          </>
        ) : null}
      </Carousel>

      {images.length > 1 ? (
        <p className="mt-2 text-center font-mono text-xs text-foreground/50">
          {inlineIndex + 1} / {images.length}
        </p>
      ) : null}

      {activeImage?.caption ? <p className="mt-2 text-center text-sm text-foreground/70">{activeImage.caption}</p> : null}
    </div>
  );
}

export function ArticleBody({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
    };

    onSelect();
    carouselApi.on('select', onSelect);

    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const mounts: InlineCarouselMount[] = [];
    mountInlineCarouselForImageStacks(container, mounts);

    return () => {
      mounts.forEach(({ root, mountNode, sourceNodes }) => {
        root.unmount();
        mountNode.remove();
        sourceNodes.forEach((node) => {
          delete node.dataset.inlineCarouselSource;
          node.hidden = false;
        });
      });
    };
  }, [html]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG') return;
    const allImgs = Array.from(containerRef.current?.querySelectorAll('img') ?? []).filter(
      (img) => !(img as HTMLElement).closest('[data-inline-carousel-source="true"]')
    );
    const startIndex = allImgs.indexOf(target as HTMLImageElement);
    if (startIndex < 0) return;
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
