import { describe, expect, it } from 'vitest';

import { extractContentMediaPreviews } from '@/lib/content/media-preview';

describe('content media preview extraction', () => {
  it('extracts proxied images and youtube thumbnails from article html', () => {
    const html = [
      '<p>Lead text</p>',
      '<img src="http://blogs.qu.edu.qa/cse/files/2021/01/image-1.png" alt="Internship poster">',
      '<p><a href="https://youtu.be/legtfYhy-iI?si=test">Watch on YouTube</a></p>'
    ].join('');

    expect(extractContentMediaPreviews(html)).toEqual([
      {
        kind: 'image',
        src: '/api/media?url=http%3A%2F%2Fblogs.qu.edu.qa%2Fcse%2Ffiles%2F2021%2F01%2Fimage-1.png',
        alt: 'Internship poster'
      },
      {
        kind: 'youtube',
        src: 'https://i.ytimg.com/vi/legtfYhy-iI/hqdefault.jpg',
        alt: 'YouTube video thumbnail'
      }
    ]);
  });

  it('extracts youtube thumbnails from elementor widgets', () => {
    const html =
      '<div class="elementor-widget-video" data-settings="{&quot;youtube_url&quot;:&quot;https:\\/\\/www.youtube.com\\/watch?v=abc123xyz&quot;,&quot;video_type&quot;:&quot;youtube&quot;}"><div class="elementor-video"></div></div>';

    expect(extractContentMediaPreviews(html)).toEqual([
      {
        kind: 'youtube',
        src: 'https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg',
        alt: 'YouTube video thumbnail'
      }
    ]);
  });

  it('keeps unique media previews beyond three items', () => {
    const html = [
      '<img src="/cse/files/2021/01/image-1.png" alt="One">',
      '<img src="/cse/files/2021/01/image-1.png" alt="One again">',
      '<img src="/cse/files/2021/01/image-2.png" alt="Two">',
      '<img src="/cse/files/2021/01/image-3.png" alt="Three">',
      '<img src="/cse/files/2021/01/image-4.png" alt="Four">'
    ].join('');

    expect(extractContentMediaPreviews(html)).toEqual([
      {
        kind: 'image',
        src: '/api/media?url=https%3A%2F%2Fblogs.qu.edu.qa%2Fcse%2Ffiles%2F2021%2F01%2Fimage-1.png',
        alt: 'One'
      },
      {
        kind: 'image',
        src: '/api/media?url=https%3A%2F%2Fblogs.qu.edu.qa%2Fcse%2Ffiles%2F2021%2F01%2Fimage-2.png',
        alt: 'Two'
      },
      {
        kind: 'image',
        src: '/api/media?url=https%3A%2F%2Fblogs.qu.edu.qa%2Fcse%2Ffiles%2F2021%2F01%2Fimage-3.png',
        alt: 'Three'
      },
      {
        kind: 'image',
        src: '/api/media?url=https%3A%2F%2Fblogs.qu.edu.qa%2Fcse%2Ffiles%2F2021%2F01%2Fimage-4.png',
        alt: 'Four'
      }
    ]);
  });
});


