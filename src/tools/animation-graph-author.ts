import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Config } from "../config.js";
import { validateProjectPath } from "../utils/safe-path.js";

interface VehicleConfig {
  vehicleName: string;
  vehicleType: string;
  wheelCount: number;
  hasTurret: boolean;
  hasSuspensionIK: boolean;
  hasShockAbsorbers: boolean;
  hasSteeringLinkage: boolean;
  seatTypes: string[];
  dialList: string[];
}

function generateAgr(cfg: VehicleConfig): string {
  const lines: string[] = [];

  lines.push("AnimSrcGraph {");
  lines.push(
    ` AnimSetTemplate "{PLACEHOLDER_GUID}${cfg.vehicleType}/${cfg.vehicleName}/workspaces/${cfg.vehicleName}.ast"`
  );
  lines.push(` ControlTemplate AnimSrcGCT "{PLACEHOLDER_GUID_2}" {`);

  // Variables
  lines.push(`  Variables {`);

  // Standard vehicle variables — order follows LAV25 pattern
  lines.push(`   AnimSrcGCTVarFloat VehicleSteering {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleThrottle {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleClutch {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleBrake {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleAccelerationLR {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleAccelerationFB {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat LookX {`);
  lines.push(`    MinValue -180`);
  lines.push(`    MaxValue 180`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat LookY {`);
  lines.push(`    MinValue -180`);
  lines.push(`    MaxValue 180`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarInt SeatPositionType {`);
  lines.push(`    MaxValue 10`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat AimY {`);
  lines.push(`    MinValue -100`);
  lines.push(`    MaxValue 100`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarBool Horn {`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat VehicleHandBrake {`);
  lines.push(`    MaxValue 2`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarBool IsDriver {`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat SpineAccelerationFB {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Vehicle_Wobble {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat SpineAccelerationLR {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat AimX {`);
  lines.push(`    MinValue -100`);
  lines.push(`    MaxValue 100`);
  lines.push(`   }`);

  // Suspension variables (always included, count matches wheelCount)
  for (let i = 0; i < cfg.wheelCount; i++) {
    lines.push(`   AnimSrcGCTVarFloat suspension_${i} {`);
    lines.push(`    MinValue -1`);
    lines.push(`    MaxValue 1`);
    lines.push(`   }`);
  }

  lines.push(`   AnimSrcGCTVarFloat Suspension_dumping {`);
  lines.push(`    MinValue -1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Suspension_shake {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat YawAngle {`);
  lines.push(`    MinValue -360`);
  lines.push(`    MaxValue 360`);
  lines.push(`   }`);

  // Wheel rotation variables
  for (let i = 0; i < cfg.wheelCount; i++) {
    lines.push(`   AnimSrcGCTVarFloat wheel_${i} {`);
    lines.push(`    MinValue -360`);
    lines.push(`    MaxValue 360`);
    lines.push(`   }`);
  }

  lines.push(`   AnimSrcGCTVarFloat steering {`);
  lines.push(`    MinValue -50`);
  lines.push(`    MaxValue 50`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Gearbox_RPM {`);
  lines.push(`    MinValue -10000`);
  lines.push(`    MaxValue 10000`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Engine_RPM {`);
  lines.push(`    MaxValue 10000`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat WaterLevel {`);
  lines.push(`    MaxValue 100`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat IsSwimming {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat IsInVehicle {`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat SPEED {`);
  lines.push(`    MinValue 0`);
  lines.push(`    MaxValue 250`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Speed_dumping {`);
  lines.push(`    MaxValue 250`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat POWER_IO {`);
  lines.push(`    DefaultValue 1`);
  lines.push(`    MaxValue 1`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat LocalTime {`);
  lines.push(`    DefaultValue 100000000`);
  lines.push(`    MaxValue 100000000`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarBool TurnOut {`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Yaw {`);
  lines.push(`    MinValue -180`);
  lines.push(`    MaxValue 180`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarFloat Pitch {`);
  lines.push(`    MinValue -50`);
  lines.push(`    MaxValue 80`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarInt VehicleDoorState {`);
  lines.push(`    MaxValue 298754968`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTVarInt VehicleDoorType {`);
  lines.push(`    MaxValue 298754968`);
  lines.push(`   }`);

  if (cfg.hasTurret) {
    lines.push(`   AnimSrcGCTVarFloat TurretRot_Antennas {`);
    lines.push(`    DefaultValue 0`);
    lines.push(`    MinValue -1`);
    lines.push(`    MaxValue 1`);
    lines.push(`   }`);
  }

  if (cfg.seatTypes.includes("gunner")) {
    lines.push(`   AnimSrcGCTVarFloat Gunner_sights_cover {`);
    lines.push(`    DefaultValue -0.71`);
    lines.push(`    MinValue -0.71`);
    lines.push(`    MaxValue 1.4`);
    lines.push(`   }`);
  }

  lines.push(`  }`);

  // Commands
  lines.push(`  Commands {`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_SwitchSeat {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Unconscious {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Unconscious_Exit {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Death {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_OpenDoor {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Wheeled_Action {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Lights {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_GetIn {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_GetOut {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_GearSwitch {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_Engine_StartStop {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_HandBrake {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_OpenDoor {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_CloseDoor {`);
  lines.push(`   }`);
  lines.push(`   AnimSrcGCTCmd CMD_Vehicle_FinishActionQueue {`);
  lines.push(`   }`);
  lines.push(`  }`);

  // IK Chains
  lines.push(`  IkChains {`);

  // Standard character limb chains
  lines.push(`   AnimSrcGCTIkChain LeftLeg {`);
  lines.push(`    Joints {`);
  lines.push(`     "leftleg"`);
  lines.push(`     "leftlegtwist"`);
  lines.push(`     "leftknee"`);
  lines.push(`     "leftkneetwist"`);
  lines.push(`     "leftfoot"`);
  lines.push(`    }`);
  lines.push(`    MiddleJoint "leftknee"`);
  lines.push(`    ChainAxis "+y"`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTIkChain RightLeg {`);
  lines.push(`    Joints {`);
  lines.push(`     "rightleg"`);
  lines.push(`     "rightlegtwist"`);
  lines.push(`     "rightknee"`);
  lines.push(`     "rightkneetwist"`);
  lines.push(`     "rightfoot"`);
  lines.push(`    }`);
  lines.push(`    MiddleJoint "rightknee"`);
  lines.push(`    ChainAxis "-y"`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTIkChain LeftArm {`);
  lines.push(`    Joints {`);
  lines.push(`     "leftarm"`);
  lines.push(`     "leftarmtwist"`);
  lines.push(`     "leftforearm"`);
  lines.push(`     "leftforearmtwist"`);
  lines.push(`     "lefthand"`);
  lines.push(`    }`);
  lines.push(`    MiddleJoint "leftforearm"`);
  lines.push(`    ChainAxis "+y"`);
  lines.push(`   }`);

  lines.push(`   AnimSrcGCTIkChain RightArm {`);
  lines.push(`    Joints {`);
  lines.push(`     "rightarm"`);
  lines.push(`     "rightarmtwist"`);
  lines.push(`     "rightforearm"`);
  lines.push(`     "rightforearmtwist"`);
  lines.push(`     "righthand"`);
  lines.push(`    }`);
  lines.push(`    MiddleJoint "rightforearm"`);
  lines.push(`    ChainAxis "-y"`);
  lines.push(`   }`);

  // Suspension IK chains
  if (cfg.hasSuspensionIK) {
    for (let i = 0; i < cfg.wheelCount; i++) {
      lines.push(`   AnimSrcGCTIkChain suspension${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_suspension${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
    }
  }

  // Shock absorber chains — rear wheels (indices >= wheelCount/2)
  if (cfg.hasShockAbsorbers) {
    const rearStart = Math.floor(cfg.wheelCount / 2);
    for (let i = rearStart; i < cfg.wheelCount; i++) {
      lines.push(`   AnimSrcGCTIkChain shock_absorber${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_shock_absorber${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
      lines.push(`   AnimSrcGCTIkChain shock_absorber_ikTarget${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_shock_absorber_ikTarget${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
    }
  }

  // Steering linkage chains — front wheels (first half)
  if (cfg.hasSteeringLinkage) {
    const frontCount = Math.floor(cfg.wheelCount / 2);
    for (let i = 0; i < frontCount; i++) {
      lines.push(`   AnimSrcGCTIkChain steering_axis_suspension${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_steering_axis_suspension${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
      lines.push(`   AnimSrcGCTIkChain steering_axis_body${i} {`);
      lines.push(`    Joints {`);
      lines.push(`     "v_steering_axis_body${i}"`);
      lines.push(`    }`);
      lines.push(`   }`);
    }
  }

  lines.push(`  }`);

  // Bone Masks
  lines.push(`  BoneMasks {`);

  // Chassis mask — wheel bones + suspension bones
  lines.push(`   AnimSrcGCTBoneMask Chassis {`);
  lines.push(`    Bones {`);

  // Generate wheel bones: L01, R01, L02, R02, etc. (pairs per axle)
  const axleCount = cfg.wheelCount / 2;
  for (let axle = 1; axle <= axleCount; axle++) {
    const axleStr = String(axle).padStart(2, "0");
    lines.push(`     "v_wheel_L${axleStr}"`);
    lines.push(`     "v_wheel_R${axleStr}"`);
  }

  // Suspension bones if IK enabled
  if (cfg.hasSuspensionIK) {
    for (let i = 0; i < cfg.wheelCount; i++) {
      lines.push(`     "v_suspension${i}"`);
    }
  }

  lines.push(`    }`);
  lines.push(`   }`);

  // Body mask — empty, user fills in
  lines.push(`   AnimSrcGCTBoneMask Body {`);
  lines.push(`    Bones {`);
  lines.push(`    }`);
  lines.push(`   }`);

  // Turret masks
  if (cfg.hasTurret) {
    lines.push(`   AnimSrcGCTBoneMask Turret {`);
    lines.push(`    Bones {`);
    lines.push(`    }`);
    lines.push(`   }`);
    lines.push(`   AnimSrcGCTBoneMask Turret_Pose {`);
    lines.push(`    Bones {`);
    lines.push(`     "v_root"`);
    lines.push(`     "v_turret_slot"`);
    lines.push(`     "v_turret_01"`);
    lines.push(`    }`);
    lines.push(`   }`);
  }

  lines.push(`  }`);

  // Global Tags
  lines.push(`  GlobalTags {`);
  lines.push(`   "VEHICLE"`);
  lines.push(`   "WHEELED"`);
  lines.push(`   "${cfg.vehicleName.toUpperCase()}"`);
  lines.push(`  }`);

  lines.push(` }`);
  lines.push(` Debug AnimSrcGD "{PLACEHOLDER_GUID_3}" {`);
  lines.push(` }`);
  lines.push(` GraphFilesResourceNames {`);
  lines.push(` }`);
  lines.push(` DefaultRunNode "MasterControl"`);
  lines.push(`}`);

  return lines.join("\n");
}

function generateAst(cfg: VehicleConfig): string {
  const seatGroupMap: Record<string, string> = {
    driver: "Driver",
    gunner: "Gunner",
    commander: "Commander",
    passenger: "Passenger",
  };

  const animsByGroup: Record<string, string[]> = {
    Driver: ["Idle", "Drive", "GetIn", "GetOut", "Death"],
    Gunner: ["Idle", "Aim", "GetIn", "GetOut", "Death"],
    Commander: ["Idle", "GetIn", "GetOut", "Death"],
    Passenger: ["Idle", "GetIn", "GetOut", "Death"],
  };

  const lines: string[] = [];
  lines.push("AnimSetTemplateSource {");
  lines.push(" Groups {");

  for (const seatType of cfg.seatTypes) {
    const groupName = seatGroupMap[seatType] ?? seatType;
    const anims = animsByGroup[groupName] ?? ["Idle", "GetIn", "GetOut", "Death"];

    lines.push(`  AnimSetTemplateSource_AnimationGroup "{PLACEHOLDER_GUID}" {`);
    lines.push(`   Name "${groupName}"`);
    lines.push(`   Animations {`);
    for (const anim of anims) {
      lines.push(`    "${anim}"`);
    }
    lines.push(`   }`);
    lines.push(`   Columns {`);
    lines.push(`    "Default"`);
    lines.push(`   }`);
    lines.push(`  }`);
  }

  lines.push(" }");
  lines.push("}");

  return lines.join("\n");
}

export function registerAnimationGraphAuthor(server: McpServer, config: Config): void {
  server.registerTool(
    "animation_graph_author",
    {
      description:
        "Generate and write .agr and .ast scaffold files for a new Arma Reforger vehicle. " +
        "Creates correctly structured animation graph resource files based on LAV25/S105 patterns. " +
        "Files are ready to open in Workbench — GUIDs will be assigned on registration. " +
        "Use before building the AGF node graph in Workbench. " +
        "Trigger: 'create animation graph for new vehicle', 'generate AGR for vehicle', 'scaffold vehicle animation'.",
      inputSchema: {
        vehicleName: z.string().describe("Vehicle name (e.g. 'MyTruck'). Used in file names and GlobalTags."),
        vehicleType: z.enum(["wheeled", "tracked", "helicopter", "boat"]).default("wheeled"),
        wheelCount: z.number().int().min(2).max(8).refine(n => n % 2 === 0, "Must be even (2/4/6/8)").default(4).describe("Number of wheels (2/4/6/8). Must be even."),
        hasTurret: z.boolean().default(false).describe("Add turret variables and bone mask."),
        hasSuspensionIK: z.boolean().default(true).describe("Add suspension IK chains."),
        hasShockAbsorbers: z.boolean().default(false).describe("Add shock absorber IK chains."),
        hasSteeringLinkage: z.boolean().default(false).describe("Add steering axis IK chains."),
        seatTypes: z.array(z.enum(["driver", "gunner", "commander", "passenger"])).default(["driver"]),
        dialList: z.array(z.string()).default([]).describe("Variable names to use as dials (e.g. ['Engine_RPM', 'SPEED'])."),
        outputPath: z.string().describe("Destination folder within mod project (e.g. 'Assets/Vehicles/MyTruck/workspaces')."),
        modName: z.string().optional().describe("Addon folder name. Uses default if omitted."),
        projectPath: z.string().optional().describe("Mod project root. Uses default if omitted."),
      },
    },
    async (opts) => {
      const basePath = opts.projectPath || config.projectPath;
      if (!basePath) {
        return { content: [{ type: "text", text: "No project path configured." }] };
      }

      const cfg: VehicleConfig = {
        vehicleName: opts.vehicleName,
        vehicleType: opts.vehicleType,
        wheelCount: opts.wheelCount,
        hasTurret: opts.hasTurret,
        hasSuspensionIK: opts.hasSuspensionIK,
        hasShockAbsorbers: opts.hasShockAbsorbers,
        hasSteeringLinkage: opts.hasSteeringLinkage,
        seatTypes: opts.seatTypes,
        dialList: opts.dialList,
      };

      try {
        const agrContent = generateAgr(cfg);
        const astContent = generateAst(cfg);

        const agrPath = validateProjectPath(basePath, `${opts.outputPath}/${opts.vehicleName}.agr`);
        const astPath = validateProjectPath(basePath, `${opts.outputPath}/${opts.vehicleName}.ast`);

        mkdirSync(dirname(agrPath), { recursive: true });
        writeFileSync(agrPath, agrContent, "utf-8");
        writeFileSync(astPath, astContent, "utf-8");

        return {
          content: [
            {
              type: "text",
              text: [
                `Generated animation graph files for ${opts.vehicleName}:`,
                `  AGR: ${opts.outputPath}/${opts.vehicleName}.agr`,
                `  AST: ${opts.outputPath}/${opts.vehicleName}.ast`,
                ``,
                `Next steps:`,
                `1. Open Workbench and register both files (right-click -> Add to project)`,
                `2. Open the AGR in Animation Editor to verify variables and IK chains`,
                `3. Create a new .agf file and build the node graph (see animation_graph_setup for guided instructions)`,
                `4. Create a .asi file mapping AST animation groups to .anm files`,
                `5. Add VehicleAnimationComponent to your vehicle prefab, set AnimGraph + AnimInstance`,
              ].join("\n"),
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `Error generating animation graph files: ${msg}` }] };
      }
    }
  );
}
