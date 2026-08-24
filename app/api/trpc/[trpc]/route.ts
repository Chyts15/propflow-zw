import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/lib/routers/_app";
import { createContext } from "@/lib/trpc";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(`[trpc] ${path ?? "<no-path>"}: ${error.message}`);
          }
        : undefined,
  });
}

export { handler as GET, handler as POST };
