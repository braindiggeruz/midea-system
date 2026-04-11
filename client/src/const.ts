export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const LOGIN_PATH = "/login";

export const getLoginUrl = (returnPath?: string) => {
  const currentPath =
    returnPath ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : "/");

  const url = new URL(LOGIN_PATH, window.location.origin);
  if (currentPath && currentPath !== LOGIN_PATH) {
    url.searchParams.set("returnTo", currentPath);
  }

  return url.toString();
};
