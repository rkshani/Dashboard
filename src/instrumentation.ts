import type { Instrumentation } from "next";

/** Every server error (pages, route handlers, server actions, proxy) is reported once here. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Redirects and not-found are control flow, not errors.
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  if (digest?.startsWith("NEXT_REDIRECT") || digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK")) return;
  const { reportError } = await import("@/lib/monitoring");
  await reportError({
    source: `server:${context.routeType}`,
    message: err instanceof Error ? err.message : String(err),
    digest,
    path: request.path,
    extra: { route: context.routePath, method: request.method },
  });
};
