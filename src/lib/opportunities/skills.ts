/**
 * Skill dictionary used to read skills out of postings and to compare them with a profile.
 * Each canonical skill lists the ways it is written in the wild.
 */
const DICT: Record<string, string[]> = {
  Kotlin: ["kotlin"],
  "Jetpack Compose": ["jetpack compose", "compose ui", "android compose"],
  Android: ["android"],
  Flutter: ["flutter"],
  Dart: ["dart"],
  React: ["react", "react.js", "reactjs"],
  "React Native": ["react native", "react-native"],
  "Next.js": ["next.js", "nextjs", "next js"],
  TypeScript: ["typescript", "ts"],
  JavaScript: ["javascript", "js", "es6"],
  "Node.js": ["node.js", "nodejs", "node js", "node"],
  Python: ["python"],
  Django: ["django"],
  FastAPI: ["fastapi"],
  Laravel: ["laravel"],
  PHP: ["php"],
  Swift: ["swift", "swiftui"],
  iOS: ["ios"],
  Java: ["java"],
  Go: ["golang", "go"],
  Rust: ["rust"],
  Ruby: ["ruby", "rails", "ruby on rails"],
  ".NET": [".net", "c#", "dotnet", "asp.net"],
  Firebase: ["firebase"],
  Supabase: ["supabase"],
  PostgreSQL: ["postgresql", "postgres"],
  MongoDB: ["mongodb", "mongo"],
  AWS: ["aws", "amazon web services"],
  GCP: ["gcp", "google cloud"],
  Azure: ["azure"],
  DevOps: ["devops", "kubernetes", "k8s", "docker", "terraform", "ci/cd"],
  "Machine learning": ["machine learning", "ml engineer", "deep learning", "pytorch", "tensorflow"],
  LLM: ["llm", "large language model", "rag", "openai", "langchain", "generative ai", "genai"],
  NLP: ["nlp", "natural language processing"],
  GraphQL: ["graphql"],
  Vue: ["vue", "vue.js", "nuxt"],
  Angular: ["angular"],
  Figma: ["figma"],
  "UI design": ["ui design", "ui designer", "interface design", "product design", "product designer"],
  "UX research": ["ux research", "user research", "ux researcher", "ux designer", "ux"],
  Branding: ["branding", "brand identity", "brand designer"],
  Illustration: ["illustration", "illustrator"],
  Motion: ["motion design", "motion graphics", "after effects"],
  Webflow: ["webflow"],
  SEO: ["seo", "search engine optimization"],
  "Google Ads": ["google ads", "adwords", "ppc", "sem"],
  "Meta Ads": ["meta ads", "facebook ads", "instagram ads", "paid social"],
  Copywriting: ["copywriting", "copywriter", "content writer", "content writing"],
  "Email marketing": ["email marketing", "lifecycle marketing", "klaviyo", "mailchimp"],
  "Social media": ["social media", "community manager", "tiktok", "instagram", "linkedin"],
  Mathematics: ["mathematics", "math", "maths"],
  Physics: ["physics"],
  Chemistry: ["chemistry"],
  English: ["english", "esl", "ielts"],
};

/** Very short aliases ("go", "ts", "js", "node", "ux") are too noisy in long prose. */
const SHORT = new Set(["go", "ts", "js", "node", "ux", "rag", "sem", "ppc", "ios", "php", "math"]);

const lookup: { canonical: string; re: RegExp; short: boolean }[] = Object.entries(DICT).flatMap(([canonical, aliases]) =>
  aliases.map((a) => ({
    canonical,
    short: SHORT.has(a),
    // Word-ish boundaries that still work for "c#", ".net", "next.js".
    re: new RegExp(`(^|[^a-z0-9+#.])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9+#])`, "i"),
  })),
);

/** `prose: true` for long descriptions: ignores the short, ambiguous aliases. */
export function extractSkills(text: string, opts: { prose?: boolean } = {}): string[] {
  const found = new Set<string>();
  const hay = ` ${text.toLowerCase()} `;
  for (const { canonical, re, short } of lookup) {
    if (found.has(canonical) || (opts.prose && short)) continue;
    if (re.test(hay)) found.add(canonical);
  }
  return [...found];
}

/** Knowing one skill implies its close companions (used to expand a profile, not a posting). */
const IMPLIES: Record<string, string[]> = {
  Flutter: ["Dart"],
  "Jetpack Compose": ["Kotlin", "Android"],
  Kotlin: ["Android"],
  "React Native": ["React", "JavaScript"],
  "Next.js": ["React", "JavaScript", "TypeScript"],
  React: ["JavaScript"],
  TypeScript: ["JavaScript"],
  Django: ["Python"],
  FastAPI: ["Python"],
  Laravel: ["PHP"],
  Swift: ["iOS"],
  Vue: ["JavaScript"],
  Angular: ["TypeScript", "JavaScript"],
};

export function expandSkills(canonical: string[]): string[] {
  const out = new Set(canonical);
  for (const s of canonical) for (const i of IMPLIES[s] ?? []) out.add(i);
  return [...out];
}

/** Map whatever the user typed ("jetpack compose", "Next JS") onto canonical names. */
export function canonicalize(skills: string[]): string[] {
  const out = new Set<string>();
  for (const s of skills) {
    const hits = extractSkills(s);
    if (hits.length) hits.forEach((h) => out.add(h));
    else out.add(s.trim());
  }
  return [...out];
}
