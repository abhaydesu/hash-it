# Scheduler design

Hash-It decides when each logged problem comes back, and in what form. It is
built on [FSRS](https://github.com/open-spaced-repetition/ts-fsrs), the
spaced-repetition model Anki offers. FSRS was designed for flashcards, so the app
adapts it to problems that take 20–60 minutes to re-solve.

The scheduling code lives in `lib/scheduler.ts` and `lib/first-intervals.ts`.
The daily queue is built in `lib/dashboard.ts`.

## Ratings

Every attempt is turned into one of the four FSRS grades. The user never picks
the grade. It comes from how the attempt went:

| Outcome                             | Rating |
| ----------------------------------- | ------ |
| Couldn't solve it                   | Again  |
| Solved with a hint or the editorial | Hard   |
| Solved cold (no help)               | Good   |
| Solved cold, fast                   | Easy   |

"Fast" means within 75% of a per-difficulty baseline (20 / 40 / 60 minutes for
Easy / Medium / Hard, adjustable in settings). Easy is withheld in two cases,
and those solves stay Good:

- On the first log, a fast solve shows existing skill, not retention.
- The first success after an Again or Hard must earn its way back first.

A cold solve is never rated below Good, however long it took. Recalling the
approach unaided is the evidence the scheduler cares about.

## FSRS configuration

Each user has a scheduler built from their settings:

- **Target retention** defaults to 0.80. FSRS picks intervals so the user should
  still remember the problem with that probability when it comes due.
- **Short-term steps are off.** FSRS's learning steps are measured in minutes,
  which makes no sense for a 40-minute re-solve. Every interval is at least a day.
- **Maximum interval is 365 days**, down from FSRS's 100-year default, so every
  problem ever logged comes back at least once a year.
- **Minimum interval after Again is 2 days.** This is a floor only. Otherwise a
  lapse follows FSRS.
- If the user has fitted weights, they replace the FSRS defaults.

## First intervals

A newly logged problem has no review history for FSRS to fit, so its first wait
is fixed by outcome:

| Logged as        | First review after |
| ---------------- | ------------------ |
| Solved cold      | 14 days            |
| Used a hint      | 10 days            |
| Saw the solution | 7 days             |
| Flagged          | 4 days             |

- The **flag wins** over the outcome. A flagged cold solve still comes back in 4 days.
- **Speed doesn't shorten the wait.** Good and Easy both get the cold interval.
- These four values are **user settings**. Changing them only affects problems
  logged afterwards.

To hand off cleanly to FSRS, the card's stability is solved back from the
chosen interval. FSRS's forgetting curve is `R = (1 + F·t/S)^D`. Solving for `S`
at the user's target retention gives

```
S = F · t / (R^(1/D) − 1)
```

so FSRS itself would schedule exactly that interval. `F` and `D` come from the
installed `ts-fsrs` package. FSRS still supplies the card's difficulty from the
first rating. From the second review on, FSRS schedules normally.

## The revisit flag

Flagging a problem means "make me re-solve this soon":

- On a new log, the flagged first interval applies.
- Flagging an existing problem **pulls its due date in** to the flagged interval
  when that is sooner. It never pushes a nearer date out.
- The next **cold solve clears** the flag.
- The flag only affects timing and lane. It never lowers the card's stability.

## Review lanes

A due problem comes back in one of two lanes:

- **Recall**: a quick check. Can you state the approach and key idea? It takes
  about a minute.
- **Resolve**: write the solution again from scratch.

The lane isn't stored on the card. It is worked out each time the queue is
built, from the problem's attempt history. The first rule that matches wins:

1. **Flagged** → Resolve.
2. **Never reviewed from the queue** → Recall. The first check is whether the
   idea stuck, whatever the original log said. Logs and imports don't count as
   reviews. Only attempts made from the queue carry a lane.
3. **Never solved cold** (only ever solved with a hint or the solution) → Resolve.
   The recall confirmed the idea. Now it needs one real solve.
4. **Two or more lapses** → Resolve.
5. **A failed recall** that hasn't been followed by a cold solve → Resolve.
6. Otherwise → Recall.

Stability is deliberately not a factor. A young card isn't weak just because
FSRS hasn't seen it much.

## Building the daily queue

The `/today` queue takes every card that is due now and applies per-day limits:

- **Caps.** By default there are at most 2 resolves and 5 recalls per day. Both
  are user settings. Reviews already done today count against the caps, so
  finishing a card doesn't pull in another.
- **Overdue overflow.** When there are more resolves than the cap allows, up to
  three of the oldest are demoted to a recall check and marked to retry as a
  full solve tomorrow. A single overdue resolve keeps its slot.
- **Resolve minimum.** By default the day includes at least one resolve. If
  none are due, the queue promotes a recall card that has a real reason to be
  re-solved: first one that was never solved cold, then one with lapses. It
  never pulls in an arbitrary card.
- **Ordering.** Resolves come first, then recalls. Within each lane, the most
  overdue card comes first, with more lapses breaking ties. Cards are then
  interleaved by pattern family, so no more than two in a row share a family.

A problem with 3 or more lapses is a **leech** and is surfaced in stats.

## Weekly checks and imports

- A missed **weekly recall check** becomes a recall follow-up the next day. It
  never touches the FSRS card, so the weekly review can't distort the schedule.
- **Imported problems** are spread over the next 60 days rather than all landing
  at once. Flagged rows and rows solved with help come first. Each card's
  starting rating comes from the row's status (failed → Again, with help →
  Hard, solved → Good).
