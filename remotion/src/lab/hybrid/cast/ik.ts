// [hybrid/cast] Analytic 2-bone IK for the rigid joint hierarchy (no skinning). Bones point along local -y in rest, the
// hinge (knee/elbow) is the local x axis. bendSign +1 = the middle joint protrudes toward the pole (knees: pole forward),
// -1 = the limb's front faces away from the pole (elbows: pole points back/out where the elbow should go).
import * as THREE from "three";

const _pa = new THREE.Vector3(), _k = new THREE.Vector3(), _axis = new THREE.Vector3(), _perp = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
const _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();

function setWorldQuat(o: THREE.Object3D, qWorld: THREE.Quaternion) {
  o.parent!.getWorldQuaternion(_qp);
  o.quaternion.copy(_qp.invert().multiply(qWorld));
  o.updateMatrixWorld(true);
}

export function solveTwoBone(
  a: THREE.Object3D, b: THREE.Object3D, c: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3, bendSign: 1 | -1,
  endQuat?: THREE.Quaternion,
) {
  const l1 = b.position.length(), l2 = c.position.length();
  a.updateWorldMatrix(true, false);
  a.getWorldPosition(_pa);
  _axis.copy(target).sub(_pa);
  let d = _axis.length();
  d = THREE.MathUtils.clamp(d, Math.abs(l1 - l2) + 1e-4, (l1 + l2) * 0.9995);
  _axis.normalize();
  const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _perp.copy(pole).addScaledVector(_axis, -pole.dot(_axis));
  if (_perp.lengthSq() < 1e-8) _perp.set(0, 0, 1).addScaledVector(_axis, -_axis.z);
  _perp.normalize();
  _k.copy(_pa).addScaledVector(_axis, cosA * l1).addScaledVector(_perp, sinA * l1);
  const cEnd = _pa.clone().addScaledVector(_axis, d);
  // upper bone frame: +y back to the parent joint, z in the bend plane, x = hinge
  _y.copy(_pa).sub(_k).normalize();
  _z.copy(_perp).addScaledVector(_y, -_perp.dot(_y)).normalize().multiplyScalar(bendSign);
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z); _qw.setFromRotationMatrix(_m);
  setWorldQuat(a, _qw);
  // lower bone frame: same hinge axis
  _y.copy(_k).sub(cEnd).normalize();
  _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z); _qw.setFromRotationMatrix(_m);
  setWorldQuat(b, _qw);
  if (endQuat) setWorldQuat(c, endQuat);
}
