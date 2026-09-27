export interface ToolEntry {
  name: string;
  description: string;
  active: boolean;
}

/**
 * `configured` is not a tool list: it means "send no override", so pi resolves
 * the loadout from `settings.json` `defaultTools` exactly like the `pi` CLI
 * does. Sessions left on it stay unpinned and keep following that setting.
 */
export const CONFIGURED_TOOL_PRESET = "configured";

export type ToolPreset = typeof CONFIGURED_TOOL_PRESET | "none" | "default" | "full";

export const PRESET_NONE: string[] = [];
export const PRESET_DEFAULT: string[] = ["read", "bash", "edit", "write"];
export const PRESET_FULL: string[] = ["bash", "read", "edit", "write", "grep", "find", "ls"];

const BUILTIN_TOOL_NAMES = new Set(PRESET_FULL);

export function getPresetFromTools(tools: ToolEntry[]): ToolPreset {
  const activeTools = tools.filter((t) => t.active);
  if (activeTools.length === 0) return "none";

  const active = activeTools
    .map((t) => t.name)
    .filter((name) => BUILTIN_TOOL_NAMES.has(name))
    .sort()
    .join(",");

  if (active === [...PRESET_DEFAULT].sort().join(",")) return "default";
  if (active === [...PRESET_FULL].sort().join(",")) return "full";
  // Built-in tools that match neither preset came from pi's configured
  // `defaultTools`, so report the session as following the configuration
  // rather than mislabelling it as one of the presets.
  return CONFIGURED_TOOL_PRESET;
}

/**
 * `undefined` means "send no override" so the session follows pi's setting.
 * Callers must omit the tool list entirely instead of sending an empty one:
 * an empty array is the explicit "all tools off" preset.
 */
export function getToolNamesForPreset(preset: ToolPreset): string[] | undefined {
  if (preset === CONFIGURED_TOOL_PRESET) return undefined;
  if (preset === "none") return [...PRESET_NONE];
  if (preset === "full") return [...PRESET_FULL];
  return [...PRESET_DEFAULT];
}
