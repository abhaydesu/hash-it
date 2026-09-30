/** Public identity of the site, shared by metadata, structured data, sitemap and llms.txt. */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://hash-it.abhaydesu.me").replace(/\/$/, "");

export const SITE_NAME = "Hash-It";

export const SITE_TITLE = "Hash-It: LeetCode Tracker with Spaced Repetition";

export const SITE_DESCRIPTION =
  "Track every LeetCode problem you solve and re-solve it right before you forget. Hash-It schedules reviews with FSRS spaced repetition, imports your LeetCode history, and shows your progress by pattern.";

export const SITE_KEYWORDS = [
  "LeetCode tracker",
  "LeetCode progress tracker",
  "track LeetCode problems",
  "LeetCode spaced repetition",
  "spaced repetition for coding interviews",
  "LeetCode revision",
  "LeetCode review schedule",
  "remember LeetCode solutions",
  "FSRS",
  "coding interview prep",
  "DSA tracker",
  "NeetCode 150 tracker",
  "Blind 75 tracker",
  "Grind 75 tracker",
];

export const AUTHOR = { name: "Abhay", handle: "abhaydesu", url: "https://abhaydesu.me" } as const;

export const GUIDE_PATH = "/guides/leetcode-spaced-repetition";

/** Pages that are public and meant to be indexed (everything else sits behind sign-in). */
export const INDEXABLE_PATHS = ["/", GUIDE_PATH] as const;

/** Answer-first Q&A shown on the landing page and mirrored in its FAQPage structured data. */
export const LANDING_FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What is Hash-It?",
    a: "Hash-It is a LeetCode tracker built on spaced repetition. You log each problem you solve, and it schedules the day you should re-solve it, right before you would forget the approach.",
  },
  {
    q: "How do I track my LeetCode progress with Hash-It?",
    a: "Press ⌘K (Ctrl+K on Windows) to log a problem after you solve it. Record how long it took, the core idea, and any mistakes. Hash-It keeps the full log, shows your stats, flags your weakest patterns, and builds a daily queue of problems to review.",
  },
  {
    q: "How does spaced repetition work for LeetCode problems?",
    a: "Hash-It uses FSRS, the same scheduling algorithm Anki offers, to estimate when you are about to forget each problem. If you struggled, the problem comes back in a day or two. If you solved it cold, it may not return for weeks. Each successful review stretches the next interval.",
  },
  {
    q: "Can I import problems I have already solved on LeetCode?",
    a: "Yes. Take a screenshot of your LeetCode progress page, paste it into any AI chatbot with the prompt Hash-It gives you, and upload the CSV it returns. You can also upload your own CSV or Excel sheet. Imported reviews are spread over 60 days so your first day isn't overwhelming.",
  },
  {
    q: "Does Hash-It work with NeetCode 150, Blind 75, or Grind 75?",
    a: "Yes. Those lists tell you what to solve first; Hash-It tells you what to solve again. Work through any list on LeetCode and log each problem, or import the problems you have finished, and Hash-It schedules the reviews.",
  },
  {
    q: "Does it support GeeksforGeeks problems?",
    a: "Yes. You can log problems from LeetCode or GeeksforGeeks, or add any other problem with a title and a link.",
  },
  {
    q: "How much time does it take each day?",
    a: "You choose. By default the daily queue holds up to two full re-solves plus a few quick recall checks, and it shows an estimated time before you start. There is also a short weekly review and an optional timed mock at the end of each month.",
  },
  {
    q: "Is Hash-It affiliated with LeetCode?",
    a: "No. Hash-It is an independent tool. You solve problems on LeetCode itself; Hash-It only links to them and keeps track of your reviews.",
  },
];

/** Public pages that get marketing chrome (no app sub-nav, footer shown). Client-safe. */
export function isMarketingPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/auth/signin" || pathname.startsWith("/guides");
}

/** Pages that end with the site footer. */
export function showsFooter(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/guides");
}
