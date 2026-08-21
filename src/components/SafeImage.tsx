'use client'

import React, { useEffect, useState } from 'react'

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string
}

export default function SafeImage({
  src,
  alt,
  className,
  fallbackSrc = '/item-placeholder.svg',
  ...props
}: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState(src)

  useEffect(() => {
    setImgSrc(src)
  }, [src])

  const handleError = () => {
    if (imgSrc !== fallbackSrc) setImgSrc(fallbackSrc)
  }

  return (
    <img
      src={imgSrc || fallbackSrc}
      alt={alt}
      className={className}
      onError={handleError}
      {...props}
    />
  )
}
