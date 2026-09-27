import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { invalidateModelsCache } from "./models-cache";

export interface CatalogRefreshError {
  provider: string;
  message: string;
}

export interface CatalogRefreshResult {
  providerIds: string[];
  aborted: boolean;
  errors: CatalogRefreshError[];
}

let inFlight: Promise<CatalogRefreshResult> | null = null;

/**
 * Revalidate the pi.dev catalog overlay that backs the built-in provider model
 * lists, the way running the `pi` CLI once would.
 *
 * pi's built-in model lists are generated when the SDK is built and this app
 * pins one SDK version, so a model a provider ships afterwards stays invisible
 * until a refresh lands in `~/.pi/agent/models-store.json`. The app's own
 * runtime paths ask for the offline half only (`allowNetwork: false`), which is
 * why the CLI was the workaround.
 *
 * A pass is only started by an explicit press, never on a timer or on the path
 * of another request, and concurrent presses are joined so two tabs cannot race
 * over the shared store file.
 */
export function refreshModelCatalog(providerIds?: readonly string[]): Promise<CatalogRefreshResult> {
  if (inFlight) return inFlight;

  const run: Promise<CatalogRefreshResult> = (async () => {
    // Network is allowed here because the press is exactly a request to
    // revalidate; `force` skips the SDK's freshness window.
    const runtime = await ModelRuntime.create({ refreshOnCreate: false, allowModelNetwork: true });
    const ids = providerIds ? [...providerIds] : runtime.getProviders().map((provider) => provider.id);
    const result = await runtime.refresh({
      force: true,
      ...(providerIds ? { providers: [...providerIds] } : {}),
    });
    invalidateModelsCache();
    return {
      providerIds: ids,
      aborted: result.aborted,
      errors: [...result.errors].map(([provider, error]) => ({ provider, message: error.message })),
    };
  })().finally(() => {
    if (inFlight === run) inFlight = null;
  });

  inFlight = run;
  return run;
}
