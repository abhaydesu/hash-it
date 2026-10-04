/** Open the global log-problem dialog (CommandBar listens for this event). */
export type LogProblemPrefill = {
  id: string;
  title: string;
  number?: number | null;
  url: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
};

export function openLogProblem(problem?: LogProblemPrefill) {
  window.dispatchEvent(
    new CustomEvent("open-command-bar", {
      detail: problem
        ? {
            problem: {
              id: problem.id,
              title: problem.title,
              number: problem.number ?? null,
              url: problem.url,
              slug: "",
              platform: "LEETCODE",
              difficulty: problem.difficulty ?? null,
              topicTags: [],
              patterns: [],
            },
          }
        : undefined,
    }),
  );
}
