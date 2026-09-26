// boxw-fx v1 特效模块：水面涟漪（高度场波动方程，半分辨率 RGBA16F ping-pong）
// 插槽：sim(模拟+落点合并) + distort(向合成提供梯度扭曲)。依赖 EXT_color_buffer_float，
// 不支持时 enabled 自动为 false（零开销）。参数：strength(0~200，与 UI 滑条同刻度)/damp
(function () {
    'use strict';

    var RIPPLE_FS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform sampler2D uA; uniform ivec2 uSize; uniform float uDamp; uniform float uAspect;' +
        'uniform vec3 uDrops[4]; uniform int uDropCount;' +
        'in vec2 vUv; out vec4 outColor;' +
        'void main(){' +
        '  ivec2 tc = ivec2(vUv * vec2(uSize));' +
        '  vec4 a = texelFetch(uA, tc, 0);' +
        '  float avg = (texelFetch(uA, clamp(tc + ivec2(-1,0), ivec2(0), uSize - 1), 0).r' +
        '             + texelFetch(uA, clamp(tc + ivec2( 1,0), ivec2(0), uSize - 1), 0).r' +
        '             + texelFetch(uA, clamp(tc + ivec2(0,-1), ivec2(0), uSize - 1), 0).r' +
        '             + texelFetch(uA, clamp(tc + ivec2(0, 1), ivec2(0), uSize - 1), 0).r) * 0.25;' +
        '  float n = (avg * 2.0 - a.g) * uDamp;' +
        '  n = clamp(n, -1.0, 1.0);' +
        '  for (int i = 0; i < 4; i++) {' +
        '    if (i >= uDropCount) break;' +
        '    vec2 d = (vUv - uDrops[i].xy) * vec2(uAspect, 1.0);' +
        '    n += uDrops[i].z * exp(-dot(d, d) * 400.0);' +
        '  }' +
        '  outColor = vec4(n, a.r, 0.0, 1.0);' +
        '}';

    BwFx.register('ripple', {
        priority: 10,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var pRipple = ctx.program(ctx.quadVS, RIPPLE_FS);
            var texA = null, texB = null, fboA = null, fboB = null;
            var rw = 0, rh = 0;
            var damp = params.damp != null ? params.damp : 0.987;
            var strength = (params.strength != null ? params.strength : 1.0) * 0.045;
            var supported = ctx.canFloat;

            return {
                enabled: supported,
                sim: function (t, dt, input) {
                    if (!texA) return;
                    var drops = input.drops ? input.drops.slice(0, 4) : [];
                    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
                    gl.viewport(0, 0, rw, rh);
                    gl.disable(gl.BLEND);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, texA);
                    gl.useProgram(pRipple);
                    gl.uniform1i(pRipple.u.uA, 0);
                    gl.uniform2i(pRipple.u.uSize, rw, rh);
                    gl.uniform1f(pRipple.u.uDamp, damp);
                    gl.uniform1f(pRipple.u.uAspect, ctx.aspect);
                    gl.uniform1i(pRipple.u.uDropCount, drops.length);
                    var arr = new Float32Array(12);
                    for (var ai = 0; ai < 4; ai++) {
                        var dd = drops[ai] || { x: 0, y: 0, s: 0 };
                        arr[ai * 3] = dd.x; arr[ai * 3 + 1] = dd.y; arr[ai * 3 + 2] = dd.s;
                    }
                    gl.uniform3fv(pRipple.u.uDrops, arr);
                    ctx.blitQuad(pRipple);
                    var tt = texA; texA = texB; texB = tt;
                    var ff = fboA; fboA = fboB; fboB = ff;
                },
                distort: function () {
                    if (!texA) return null;
                    return { tex: texA, w: rw, h: rh, strength: strength };
                },
                resize: function (pw, ph) {
                    var nw = Math.max(2, Math.round(pw / 2));
                    var nh = Math.max(2, Math.round(ph / 2));
                    if (!supported || (nw === rw && nh === rh)) return;
                    if (texA) {
                        gl.deleteTexture(texA); gl.deleteTexture(texB);
                        gl.deleteFramebuffer(fboA); gl.deleteFramebuffer(fboB);
                    }
                    rw = nw; rh = nh;
                    texA = ctx.makeTex(rw, rh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null, gl.LINEAR);
                    texB = ctx.makeTex(rw, rh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null, gl.LINEAR);
                    fboA = ctx.makeFbo(texA);
                    fboB = ctx.makeFbo(texB);
                },
                setEnabled: function () {
                    // v1 不做显存释放：关闭态由 core 跳过 sim/distort 槽位，即零绘制开销
                },
                setParam: function (id, value) {
                    // strength 与 UI 滑条同刻度（0~200，100=标准强度）
                    if (id === 'strength') strength = (Number(value) || 0) / 100 * 0.045;
                    else if (id === 'damp') damp = Number(value) || 0.987;
                }
            };
        }
    });
})();
