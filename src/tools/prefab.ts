import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Config } from "../config.js";
import {
  generatePrefab,
  getPrefabSubdirectory,
  getPrefabFilename,
  type PrefabType,
  type ComponentDef,
} from "../templates/prefab.js";
import {
  walkChain,
  mergeAncestryComponents,
  type AncestorLevel,
} from "../utils/prefab-ancestry.js";
import { validateFilename } from "../utils/safe-path.js";

// ── Inspect helpers ────────────────────────────────────────────────────────────

function formatReport(
  levels: AncestorLevel[],
  warnings: string[],
  includeRaw: boolean
): string {
  const lines: string[] = [];

  lines.push("=== Prefab Inheritance Chain ===");
  for (const level of levels) {
    const tag = level.depth === levels.length - 1 ? "  ← this file" : "";
    lines.push(`  [${level.depth}] ${level.path}  [${level.entityClass}]${tag}`);
  }

  if (warnings.length > 0) {
    lines.push("");
    for (const w of warnings) lines.push(`  WARNING: ${w}`);
  }

  const merged = mergeAncestryComponents(levels);

  lines.push("");
  lines.push("=== Merged Components ===");

  if (merged.size === 0) {
    lines.push("  (no components found in chain)");
  }

  for (const [, { comp, source }] of merged) {
    const isLeaf = source.depth === levels.length - 1;
    const srcTag = isLeaf ? "← this file" : `inherited from [${source.depth}]: ${source.path}`;
    lines.push("");
    lines.push(`[${comp.typeName} {${comp.guid}}]  ${srcTag}`);
    for (const bl of comp.rawBody.split("\n")) {
      if (bl.trim()) lines.push(`  ${bl}`);
    }
  }

  if (includeRaw) {
    lines.push("");
    lines.push("=== Raw File Contents ===");
    for (const level of levels) {
      lines.push(`\n--- [${level.depth}] ${level.path} ---\n${level.rawContent}`);
    }
  }

  return lines.join("\n");
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerPrefab(server: McpServer, config: Config): void {
  server.registerTool(
    "prefab",
    {
      description:
        "Create or inspect Arma Reforger prefab (.et) files.\n\n" +
        "action=create: Create a new Entity Template (.et) prefab file for an Arma Reforger mod. Generates a properly structured prefab with components in valid Enfusion text serialization format. " +
        "When parentPrefab is provided, automatically resolves the full ancestor chain and pre-populates inherited components (set includeAncestry=false to skip). " +
        "IMPORTANT: For 'interactive' and other visible prefabs, the MeshObject component MUST have its 'Object' property set to a base game .xob model path (e.g., '{5F4C4181F065B447}Assets/Props/Military/Barrels/BarrelGreen_01.xob') or the entity will be invisible in-game. Use api_search to find model paths.\n\n" +
        "action=inspect: Inspect an Arma Reforger prefab (.et file) and its full inheritance chain. " +
        "Reads each ancestor prefab, parses all components, and returns a fully merged view " +
        "showing which ancestor each component comes from. " +
        "Child values override parent values (matched by component GUID). " +
        "Use this to understand the complete component set of a prefab, including all " +
        "inherited values not visible in the prefab file itself.",
      inputSchema: {
        action: z.enum(["create", "inspect"]).describe(
          "Action to perform: 'create' to generate a new prefab file, 'inspect' to view the full inheritance chain of an existing prefab."
        ),
        // create params
        name: z
          .string()
          .min(1)
          .optional()
          .describe("(create) Prefab name (e.g., 'MySpawnPoint', 'CustomVehicle')"),
        prefabType: z
          .enum([
            "character",
            "vehicle",
            "weapon",
            "spawnpoint",
            "gamemode",
            "interactive",
            "generic",
          ])
          .optional()
          .describe(
            "(create) Prefab template type. Determines the root entity type, default components, and file location."
          ),
        parentPrefab: z
          .string()
          .optional()
          .describe(
            "(create) Parent prefab to inherit from (e.g., '{GUID}Prefabs/Weapons/AK47.et'). Omit to create a standalone prefab."
          ),
        components: z
          .array(
            z.object({
              type: z.string().describe("Component class name (e.g., 'RigidBody', 'MeshObject')"),
              properties: z
                .record(z.string())
                .optional()
                .describe("Component property key-value pairs"),
            })
          )
          .optional()
          .describe("(create) Additional components to add beyond the defaults for this prefab type"),
        description: z
          .string()
          .optional()
          .describe(
            "(create) Description for the prefab. Used as the display name in Game Master."
          ),
        includeAncestry: z
          .boolean()
          .default(true)
          .describe(
            "(create) When parentPrefab is provided, resolve the full ancestor chain and pre-populate inherited components. " +
            "Defaults to true. Set false to skip ancestry resolution (uses hardcoded template defaults instead)."
          ),
        // inspect params
        path: z.string().optional().describe(
          "(inspect) Relative prefab path, e.g. 'Prefabs/Weapons/Handguns/M9/Handgun_M9.et'. " +
          "A leading {GUID} prefix is accepted and stripped automatically."
        ),
        include_raw: z.boolean().default(false).describe(
          "(inspect) Include the full raw .et text for each ancestor at the bottom of the report."
        ),
        // shared params
        projectPath: z
          .string()
          .optional()
          .describe("Addon root path / mod project root. Uses configured default if omitted."),
      },
    },
    async (params) => {
      const { action } = params;

      if (action === "create") {
        const { name, prefabType, parentPrefab, components, description, includeAncestry, projectPath } = params;
        const basePath = projectPath || config.projectPath;

        try {
          if (!name) {
            return {
              content: [{ type: "text", text: "Error creating prefab: 'name' is required for action=create" }],
              isError: true,
            };
          }
          if (!prefabType) {
            return {
              content: [{ type: "text", text: "Error creating prefab: 'prefabType' is required for action=create" }],
              isError: true,
            };
          }

          validateFilename(name);

          // Resolve ancestry if parentPrefab is given and includeAncestry is not disabled
          let ancestorComponents: ComponentDef[] | undefined;
          let ancestryNote = "";

          if (parentPrefab && includeAncestry) {
            const { levels, warnings } = walkChain(parentPrefab, config, projectPath);
            if (levels.length > 0) {
              const merged = mergeAncestryComponents(levels);
              ancestorComponents = Array.from(merged.values()).map(({ comp }) => ({
                type: comp.typeName,
                guid: comp.guid,
                // Properties intentionally empty: components are listed as GUID-matched
                // override slots, not property copies. Fill values manually as needed.
                properties: {},
              }));
              ancestryNote = `\n\nAncestry resolved: ${levels.length} ancestor level(s), ${ancestorComponents.length} inherited component(s) pre-populated.`;
              if (warnings.length > 0) {
                ancestryNote += `\nWarnings: ${warnings.join("; ")}`;
              }
            } else {
              ancestryNote = `\n\nAncestry resolution unavailable (game files not found). Using template defaults.`;
              if (warnings.length > 0) {
                ancestryNote += ` Warnings: ${warnings.join("; ")}`;
              }
            }
          }

          const content = generatePrefab({
            name,
            prefabType: prefabType as PrefabType,
            parentPrefab,
            components: components as ComponentDef[] | undefined,
            description,
            ancestorComponents,
          });

          if (basePath) {
            const subdir = getPrefabSubdirectory(prefabType as PrefabType);
            const filename = getPrefabFilename(name);
            const targetDir = resolve(basePath, subdir);
            const targetPath = join(targetDir, filename);

            mkdirSync(targetDir, { recursive: true });

            if (existsSync(targetPath)) {
              return {
                content: [
                  {
                    type: "text",
                    text: `File already exists: ${subdir}/${filename}\n\nGenerated content (not written):\n\n\`\`\`\n${content}\n\`\`\`${ancestryNote}`,
                  },
                ],
              };
            }

            writeFileSync(targetPath, content, "utf-8");

            const meshWarning = (prefabType === "interactive" || prefabType === "generic")
              ? "\n\nIMPORTANT: The MeshObject 'Object' property is empty. You MUST set it to a base game .xob model path (e.g., '{5F4C4181F065B447}Assets/Props/Military/Barrels/BarrelGreen_01.xob') or the entity will be INVISIBLE in-game. Use project_write to update the prefab."
              : "";

            return {
              content: [
                {
                  type: "text",
                  text: `Prefab created: ${subdir}/${filename}\n\n\`\`\`\n${content}\n\`\`\`${meshWarning}${ancestryNote}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `Generated prefab (no project path configured — not written to disk):\n\n\`\`\`\n${content}\n\`\`\`\n\nSet ENFUSION_PROJECT_PATH to write files automatically.${ancestryNote}`,
              },
            ],
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return {
            content: [{ type: "text", text: `Error creating prefab: ${msg}` }],
            isError: true,
          };
        }
      }

      // action === "inspect"
      const { path: inputPath, include_raw, projectPath } = params;

      try {
        if (!inputPath) {
          return {
            content: [{ type: "text", text: "Error: 'path' is required for action=inspect" }],
            isError: true,
          };
        }

        const { levels, warnings } = walkChain(inputPath, config, projectPath);

        if (levels.length === 0) {
          return {
            content: [{
              type: "text",
              text: `Could not read prefab: ${inputPath}\n` +
                (warnings.length > 0 ? warnings.join("\n") : "File not found."),
            }],
            isError: true,
          };
        }

        return {
          content: [{
            type: "text",
            text: formatReport(levels, warnings, include_raw ?? false),
          }],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    }
  );
}
