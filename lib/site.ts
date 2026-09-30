/** Public identity of the site, shared by metadata, structured data, sitemap and llms.txt. */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://hash-it.abhaydesu.me").replace(/\/$/, "");

export const SITE_NAME = "Hash-It";

export const SITE_TITLE = "Hash-It: LeetCode & DSA Tracker with Spaced Repetition";

export const SITE_DESCRIPTION =
  "LeetCode and DSA tracker: log every problem you solve, then re-solve it right before you forget with spaced repetition. Import your LeetCode history or DSA sheet.";

export const SITE_KEYWORDS = [
  "LeetCode tracker",
  "LeetCode progress tracker",
  "DSA tracker",
  "DSA progress tracker",
  "DSA practice tracker",
  "DSA log",
  "DSA logging",
  "DSA revision",
  "DSA sheet tracker",
  "data structures and algorithms tracker",
  "track LeetCode problems",
  "LeetCode spaced repetition",
  "spaced repetition for coding interviews",
  "LeetCode revision",
  "LeetCode review schedule",
  "remember LeetCode solutions",
  "FSRS",
  "coding interview prep",
  "NeetCode 150 tracker",
  "Blind 75 tracker",
  "Grind 75 tracker",
];

export const AUTHOR = { name: "Abhay", handle: "abhaydesu", url: "https://abhaydesu.me" } as const;

export const GUIDE_PATH = "/guides/dsa-spaced-repetition";
/** Earlier URL of the guide; permanently redirected to GUIDE_PATH (next.config.ts). */
export const LEGACY_GUIDE_PATH = "/guides/leetcode-spaced-repetition";

/** Pages that are public and meant to be indexed (everything else sits behind sign-in). */
export const INDEXABLE_PATHS = ["/", GUIDE_PATH] as const;

/** Landing-page FAQ, written for a first-time visitor. Mirrored in the page's FAQPage structured data. */
export const LANDING_FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What is Hash-It, in plain terms?",
    a: "A log for the DSA problems you solve that tells you when to solve them again. You add a problem after you solve it, and a few days or weeks later it shows up in your queue so you can try it from scratch, before you've forgotten how it works.",
  },
  {
    q: "Do I solve problems on Hash-It?",
    a: "No. You keep solving on LeetCode, GeeksforGeeks or wherever you already practice. Hash-It keeps track of what you've done and what's due, and every problem in your queue links back to the original.",
  },
  {
    q: "How is this different from tracking DSA in a spreadsheet?",
    a: "A spreadsheet shows what you've solved. It won't tell you that the graph problem from three weeks ago is about to slip. Hash-It works out when each problem is due from how it went last time, so you don't have to keep track of dates yourself.",
  },
  {
    q: "I've already solved a lot of problems. Do I have to add them one by one?",
    a: "No. Upload your DSA sheet as an Excel or CSV file, or, if you solve on LeetCode, import from a screenshot of your progress page. Imported problems are spread over the next 60 days, so you won't log in to 300 reviews on day one.",
  },
  {
    q: "What does a normal day look like?",
    a: "Open Today and do what's due. Most items are quick recall checks: read the title, remember the approach, check your notes. A couple are full re-solves where you actually code it again. By default that's at most two re-solves a day, and you can change that in settings.",
  },
  {
    q: "What if I can't solve it the second time either?",
    a: "That happens, and it's useful to know. Mark it as \"Saw solution\" and it comes back in a day or two instead of weeks later. Problems you keep missing show up as stuck, so you know which ones need a proper second look.",
  },
  {
    q: "What happens if I skip a few days?",
    a: "Nothing breaks. Missed problems wait in your queue, and the daily limit means you won't come back to 40 re-solves at once. It just takes a few days to catch up.",
  },
  {
    q: "Do I have to write notes for every problem?",
    a: "No, but it's worth it. One line on the key idea and one on what you got wrong is plenty. When the problem comes back, that's what you check yourself against.",
  },
  {
    q: "How does it decide when a problem comes back?",
    a: "It uses FSRS, the scheduling algorithm Anki offers. Solve something cold and the gap before you see it again gets longer each time, from days to weeks to months. Need a hint and it comes back sooner.",
  },
  {
    q: "Does it work if I don't use LeetCode?",
    a: "Yes. GeeksforGeeks links fill in the title and difficulty automatically, same as LeetCode. For problems from anywhere else, add the title and link yourself and everything else works the same.",
  },
  {
    q: "What do I need to get started?",
    a: "A Google account. Sign in, and you can log your first problem straight away. Your log is private to you.",
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
