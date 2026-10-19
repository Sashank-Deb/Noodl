import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "./site";

/**
 * Per-page metadata. Titles go through the root template "%s · noodl".
 * OG/Twitter images come from the nearest `opengraph-image.tsx` file.
 */
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  publishedTime,
  absoluteTitle,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  publishedTime?: string;
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      url: path,
      siteName: SITE_NAME,
      locale: "en_US",
      title: fullTitle,
      description,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}

/* ---------- JSON-LD ------------------------------------------------------- */

type Json = Record<string, unknown>;

export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so content can never close the script element.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export const ORG_ID = `${SITE_URL}/#organization`;
export const SITE_ID = `${SITE_URL}/#website`;
export const APP_ID = `${SITE_URL}/#app`;

export function organizationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon-512.png"),
  };
}

export function websiteLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    name: SITE_NAME,
    url: absoluteUrl("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

export function softwareApplicationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: SITE_NAME,
    url: absoluteUrl("/app/"),
    description: SITE_DESCRIPTION,
    applicationCategory: "ProductivityApplication",
    applicationSubCategory: "BusinessApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires a modern browser with JavaScript and IndexedDB.",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Outline and mind map views of the same note",
      "Typeahead suggestions on every node, with offline fallback to your own notes",
      "Generate a mind map from a prompt",
      "Summarize pasted text into a map",
      "Rewrite a node",
      "Works offline, guest mode by default",
      "Optional Google sign-in to sync across devices",
      "Export to PNG, JPEG, PDF, Markdown, HTML and JSON",
      "Templates",
    ],
    publisher: { "@id": ORG_ID },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function faqLd(items: { q: string; a: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

export function blogPostingLd(post: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: absoluteUrl(post.path),
    mainEntityOfPage: absoluteUrl(post.path),
    datePublished: post.datePublished,
    dateModified: post.dateModified ?? post.datePublished,
    image: absoluteUrl(`${post.path}opengraph-image.png`),
    inLanguage: "en",
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
}
