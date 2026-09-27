/** Open the global log-problem dialog (CommandBar listens for this event). */
export function openLogProblem() {
  window.dispatchEvent(new CustomEvent("open-command-bar"));
}
