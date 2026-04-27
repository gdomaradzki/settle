import React from "react";

// Minimal stub — no import from "next/link" to avoid circular alias resolution.
export default function Link({
  href,
  children,
  ...props
}: {
  href: string | Record<string, unknown>;
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  const resolvedHref = typeof href === "string" ? href : JSON.stringify(href);
  return (
    <a href={resolvedHref} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  );
}
