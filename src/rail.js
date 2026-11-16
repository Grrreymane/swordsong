import * as THREE from 'three';

const A1 = 92, K1 = 0.0019, A2 = 30, K2 = 0.0047, P2 = 1.3;
const B1 = 7, M1 = 0.0031, Q1 = 0.7, B2 = 3, M2 = 0.0083;
const UPW = new THREE.Vector3(0, 1, 0);

export const Rail = {
  pos(s, out) {
    return out.set(
      A1 * Math.sin(K1 * s) + A2 * Math.sin(K2 * s + P2),
      B1 * Math.sin(M1 * s + Q1) + B2 * Math.sin(M2 * s),
      -s);
  },
  // frame: {p, t, r, u}
  frame(s, F) {
    this.pos(s, F.p);
    const dx = A1 * K1 * Math.cos(K1 * s) + A2 * K2 * Math.cos(K2 * s + P2);
    const dy = B1 * M1 * Math.cos(M1 * s + Q1) + B2 * M2 * Math.cos(M2 * s);
    F.t.set(dx, dy, -1).normalize();
    F.r.set(-F.t.z, 0, F.t.x).normalize();
    F.u.crossVectors(F.r, F.t).normalize();
    const ddx = -A1 * K1 * K1 * Math.sin(K1 * s) - A2 * K2 * K2 * Math.sin(K2 * s + P2);
    const roll = Math.max(-0.3, Math.min(0.3, ddx * 260));
    const c = Math.cos(roll), sn = Math.sin(roll);
    const ux = F.u.x * c + F.r.x * sn, uy = F.u.y * c + F.r.y * sn, uz = F.u.z * c + F.r.z * sn;
    const rx = F.r.x * c - F.u.x * sn, ry = F.r.y * c - F.u.y * sn, rz = F.r.z * c - F.u.z * sn;
    F.u.set(ux, uy, uz); F.r.set(rx, ry, rz);
    F.roll = roll;
    return F;
  },
  makeFrame() { return { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), u: new THREE.Vector3(), roll: 0 }; },
  // flat (unrolled) placement for scenery
  place(s, x, y, out) {
    this.pos(s, out);
    const dx = A1 * K1 * Math.cos(K1 * s) + A2 * K2 * Math.cos(K2 * s + P2);
    const inv = 1 / Math.sqrt(dx * dx + 1);
    out.x += x * inv; out.z += x * dx * inv; out.y = y;
    return out;
  },
};
export { UPW };
