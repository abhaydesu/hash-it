# Hash-It

A spaced-repetition tracker for coding interview problems. Log problems from LeetCode or your own sheet, get daily review queues, practice by pattern, and watch your mastery grow.

Built with Next.js, Postgres, and FSRS scheduling. Sign in with Google.

---

## Getting Started

1. **Sign in** with your Google account
2. **Import problems** from an Excel sheet or CSV file, or log them one by one
3. **Review daily** — solve a few problems each day to keep them fresh
4. **Practice patterns** — drill specific techniques (DP, graphs, searching, etc.)
5. **Track progress** — see your improvement over time

## How It Works

### Import your problems (`/import`)
Upload a `.csv` or `.xlsx` file with your problems:
- Columns: Problem Name, Problem Link, Pattern, Idea, Solved Date (optional)
- The app matches problems to LeetCode/GFG automatically; unmatched ones get flagged for review
- Sheet order is preserved: if you don't have a "Solved Date", the order you listed them is remembered
- Dry-run before committing: see duplicates, conflicts, and what gets created

### Daily reviews (`/today`)
Each day, the app suggests problems to review based on spaced-repetition timing:
- Easy problems come up less often (you know them)
- Hard problems come up more often (you need practice)
- Marked problems ("revisit", "leech" with 3+ wrong attempts) surface first
- Rate each review as easy, good, or hard to adjust timing

### Practice patterns (`/practice`)
Pick a technique to drill: DP, graphs, sliding windows, etc.
- See 3 unsolved problems (one easy, one medium, one hard)
- Each pattern is smart: a DP problem tagged "Array" on LeetCode stays under DP, not Array
- Log problems right there; shuffle to get fresh ones

### All problems (`/problems`)
Full log of everything you've solved:
- Filter by status (solved, attempted, to-do), difficulty, or pattern
- Sort by date, problem number, or topic—click column headers
- See your notes, time spent, mistake notes, and when you solved it
- Export as CSV for backup

### Weekly & monthly reviews (`/review/weekly`, `/review/monthly`)
- **Weekly**: random unsolved problems, your "revisit" pile, and pattern-specific drills
- **Monthly**: stats on what you've done, patterns you're strong in, and trends

---

## Tips

- **Import first**: Bring in all your old problems at once so the app knows what you've done
- **Review daily**: Just 5–10 minutes a day keeps problems fresh
- **Add notes**: Write down mistakes and ideas while they're fresh; read them next time you revisit
- **Sort by "Solved"**: If you didn't import dates, click the "Solved" column to see problems in the order you listed them
- **Custom fields**: Add your own columns (e.g., "company", "video source") in Settings and they'll show in your log

---

## Features

- **Spaced repetition** — Uses FSRS scheduling to optimize when you review each problem
- **Pattern mastery** — Track your strength in DP, graphs, arrays, etc.
- **Flexible import** — CSV, Excel, or manual entry; matches LeetCode/GFG automatically
- **Stats & insights** — See what you're good at and where you need work
- **Private** — Your data is yours; sign in with Google, but nothing is shared
