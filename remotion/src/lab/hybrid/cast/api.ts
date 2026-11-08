// [hybrid/cast] Public API of the cast library (import from here in shots/ and set/; index.ts is the Remotion test entry).
export { buildCharacter, proportions } from "./character";
export type { Character, CharacterSpec, Proportions, Accessory, Build } from "./character";
export { RAFA, NOOR, CAST, asAtRisk } from "./specs";
export { POSES, HANDS, JOINTS, mixPose, mirrorPose, mixHand, keyed, EASE, breathe, drift, tremble } from "./poses";
export type { Pose, PoseName, JointName, HandShape, HandCurl, Key, EaseName, Rot } from "./poses";
export { EXPR, mixFace } from "./face";
export type { ExprName, FaceParams } from "./face";
export { solveTwoBone } from "./ik";
