/** Search and sharing details used across the site: the canonical address,
 *  the words people search with, and structured data (JSON-LD) describing
 *  Taleo and its stories to search engines. */

export const SITE_URL = "https://taleo-stories.app";
export const SITE_NAME = "Taleo";

export const SITE_TITLE = "Taleo: personalised bedtime picture books for your child";
export const SITE_DESCRIPTION =
  "Make watercolour bedtime stories with your little one: choose a hero, decide together what happens next, and read along aloud. Stories that grow with your child, from 18 months to 6+.";

/** What parents search for. (Most search engines ignore the keywords tag,
 *  but some smaller ones and in-app search still read it.) */
export const SITE_KEYWORDS = [
  "bedtime stories",
  "bedtime stories for kids",
  "personalised bedtime stories",
  "personalized bedtime stories",
  "picture books",
  "children's stories",
  "stories for toddlers",
  "read aloud stories",
  "interactive stories for kids",
  "choose your own adventure for kids",
  "early childhood education",
  "early literacy",
  "learn to read",
  "vocabulary for toddlers",
  "AI story generator for kids",
  "watercolour picture books",
  "parenting",
];

/** The site's default link-preview picture (1200×630): the home page's
 *  opening painting beside its headline. */
export const OG_IMAGE = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "Taleo: a watercolour picture-book page of a laughing bear and a rabbit leaping over a puddle, beside the words 'Stories dreamt up at bedtime, painted just for you'",
};

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

/** JSON for a <script type="application/ld+json">, with "<" escaped so a
 *  story title can never close the script tag. */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

/** Who makes Taleo, and the site itself (with its search-friendly name). */
export const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  // (what people search for - the site's own domain name)
  alternateName: ["Taleo Stories", "taleo-stories.app"],
  url: SITE_URL,
  logo: absoluteUrl("/icon-512.png"),
  slogan: "By parents, for parents",
};

export const WEBSITE = {
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: ["Taleo Stories", "taleo-stories.app"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

/** The app: an educational web app for families, free to read. */
export const WEB_APPLICATION = {
  "@type": "WebApplication",
  "@id": `${SITE_URL}/#app`,
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any (web browser)",
  inLanguage: "en",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  audience: { "@type": "PeopleAudience", audienceType: "Parents of young children" },
  educationalUse: ["Reading aloud", "Early literacy", "Vocabulary building"],
  typicalAgeRange: "1-7",
  featureList: [
    "Personalised bedtime stories with your child's own characters",
    "Choose what happens next, page by page",
    "Watercolour illustrations for every page",
    "Read-aloud narration with calm background music",
    "Vocabulary and sentence length matched to your child's age",
  ],
  publisher: { "@id": `${SITE_URL}/#organization` },
};

/** "Home > Library > ..." trail shown under results. */
export const breadcrumbs = (trail: { name: string; path: string }[]) => ({
  "@type": "BreadcrumbList",
  itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: absoluteUrl(t.path) })),
});

/** Never crawled: the API and the admin dashboard. (Personal pages such as
 *  My stories carry a "noindex" tag instead, which search engines can only
 *  see if they're allowed to visit.) */
export const PRIVATE_PATHS = ["/api/", "/admin"];
