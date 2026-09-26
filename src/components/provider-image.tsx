'use client';
import Image from 'next/image';
import { useState } from 'react';
export function ProviderImage({
  src,
  alt,
  size,
  fallback,
  eager = false,
}: {
  src: string;
  alt: string;
  size: number;
  fallback: React.ReactNode;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  return failed === src ? (
    fallback
  ) : (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      loading={eager ? 'eager' : 'lazy'}
      className="team-logo"
      unoptimized={!src.startsWith('https://media.api-sports.io/')}
      onError={() => setFailed(src)}
    />
  );
}
