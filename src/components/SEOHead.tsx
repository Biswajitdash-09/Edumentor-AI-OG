import { Helmet } from "react-helmet-async";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  canonicalUrl?: string;
  noIndex?: boolean;
}

const defaultTitle = "EduMentor AI - Smart Learning Management System";
const defaultDescription = "EduMentor AI is an intelligent learning management system featuring AI-powered mentoring, attendance tracking, course management, and student analytics for modern educational institutions.";
const defaultKeywords = "LMS, learning management system, AI mentor, education, attendance tracking, course management, student analytics, faculty dashboard, online learning";

export function SEOHead({
  title,
  description = defaultDescription,
  keywords = defaultKeywords,
  ogImage = "/og-image.png",
  ogType = "website",
  canonicalUrl,
  noIndex = false,
}: SEOHeadProps) {
  const fullTitle = title ? `${title} | EduMentor AI` : defaultTitle;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />

      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* No Index */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Additional Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#6366f1" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    </Helmet>
  );
}
