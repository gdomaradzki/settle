import React from "react";

// Minimal stub — no import from "next/image" to avoid circular alias resolution.
// React.createElement avoids the @next/next/no-img-element JSX rule.
export default function Image({
  src,
  alt,
  ...props
}: {
  src: string | Record<string, unknown>;
  alt: string;
  [key: string]: unknown;
}) {
  return React.createElement("img", {
    src: typeof src === "string" ? src : "",
    alt,
    ...(props as React.ImgHTMLAttributes<HTMLImageElement>),
  });
}
