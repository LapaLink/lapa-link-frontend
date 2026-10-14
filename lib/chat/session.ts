/**
 * What the chat socket does after a STOMP ERROR frame:
 * - `refresh`: rotate the expired access token, then reconnect;
 * - `reconnect`: reconnect as is (the token was already replaced);
 * - `logout`: the session is over, behave like a failed REST request;
 * - `stop`: stop reconnecting but keep the session.
 */
export type StompErrorAction = "refresh" | "reconnect" | "logout" | "stop"

/**
 * Decides on an ERROR code. The server sends SESSION_NOT_FOUND to every socket
 * whenever the user's only active access token is replaced, including on each
 * refresh, so it ends the session only if the token used for CONNECT is still
 * the stored one.
 */
export function resolveStompError(
  code: string,
  usedToken: string | null,
  currentToken: string | null,
): StompErrorAction {
  if (code === "USER_BLOCKED" || code === "ACCESS_DENIED") return "stop"
  if (!code.startsWith("TOKEN_") && code !== "SESSION_NOT_FOUND")
    return "reconnect"
  if (!currentToken) return "logout"
  if (usedToken && currentToken !== usedToken) return "reconnect"
  return code === "TOKEN_EXPIRED" ? "refresh" : "logout"
}
