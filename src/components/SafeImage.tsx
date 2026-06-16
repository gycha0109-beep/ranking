'use client'

import React, { useState, useEffect } from 'react'

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string
}

export default function SafeImage({
  src,
  alt,
  className,
  fallbackSrc = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
  ...props
}: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState(src)

  // Sync state if src prop changes externally
  useEffect(() => {
    setImgSrc(src)
  }, [src])

  const handleError = () => {
    setImgSrc(fallbackSrc)
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
