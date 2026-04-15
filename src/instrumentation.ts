export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: {
    routerKind: string
    routePath: string
    routeType: string
    renderSource?: string
    revalidateReason?: string
  },
) {
  const e = err as Error & { digest?: string }
  console.error('[onRequestError]', {
    digest: e?.digest,
    message: e?.message,
    stack: e?.stack,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  })
}
