# Emulate D3D/ANGLE pow(): negative base -> NaN. Prepended into every shader via a shaderSource patch.
PATCH = r'''
(() => {
  const P = `
float _pw(float a, float b){ return a < 0.0 ? sqrt(a - 1.0) : pow(a, b); }
vec2 _pw(vec2 a, vec2 b){ return vec2(_pw(a.x, b.x), _pw(a.y, b.y)); }
vec3 _pw(vec3 a, vec3 b){ return vec3(_pw(a.x, b.x), _pw(a.y, b.y), _pw(a.z, b.z)); }
vec4 _pw(vec4 a, vec4 b){ return vec4(_pw(a.x, b.x), _pw(a.y, b.y), _pw(a.z, b.z), _pw(a.w, b.w)); }
#define pow _pw
`;
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const orig = C.prototype.shaderSource;
    C.prototype.shaderSource = function (sh, src) {
      const lines = src.split('\n'); let k = -1;
      for (let i = 0; i < Math.min(lines.length, 60); i++) if (/^precision /.test(lines[i])) k = i;
      if (k >= 0 && /\bpow\s*\(/.test(src)) { lines.splice(k + 1, 0, P); src = lines.join('\n'); }
      return orig.call(this, sh, src);
    };
  }
})();
'''
