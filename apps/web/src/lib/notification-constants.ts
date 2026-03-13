/** How long (ms) an agent must stay in `awaiting_input` before a notification fires.
 *  Prevents spam from rapid status back-and-forth while the agent is still working. */
export const AWAITING_INPUT_DEBOUNCE_MS = 2000;