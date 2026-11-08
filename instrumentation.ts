import type { Instrumentation } from "next";

/** Any error the server doesn't otherwise handle (a page or API route that
 *  crashes) is emailed to the dev inbox - see src/server/alerts.ts. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { reportError } = await import("./src/server/alerts");
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  await reportError(`server (${context.routeType})`, err, {
    path: `${request.method} ${request.path}`,
    route: context.routePath,
    digest,
  });
};
