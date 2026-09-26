// boxw-fx v1 特效模块：泛光（亮部提取 → 1/4 分辨率分离 5-tap 高斯 → 加色合成）
// 插槽：post(读 sceneTex 产出) + additive(向合成提供亮部纹理)。参数：threshold/intensity
(function () {
    'use strict';

    var BRIGHT_FS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform sampler2D uScene; uniform float uThreshold;' +
        'in vec2 vUv; out vec4 outColor;' +
        'void main(){' +
        '  vec3 c = texture(uScene, vUv).rgb;' +
        '  float b = max(c.r, max(c.g, c.b));' +
        '  outColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.35, b), 1.0);' +
        '}';

    var BLUR_FS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform sampler2D uTex; uniform vec2 uDir;' +
        'in vec2 vUv; out vec4 outColor;' +
        'void main(){' +
        '  vec4 s = texture(uTex, vUv) * 0.227;' +
        '  s += (texture(uTex, vUv + uDir * 1.384) + texture(uTex, vUv - uDir * 1.384)) * 0.316;' +
        '  s += (texture(uTex, vUv + uDir * 3.230) + texture(uTex, vUv - uDir * 3.230)) * 0.070;' +
        '  outColor = s;' +
        '}';

    BwFx.register('bloom', {
        priority: 30,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var pBright = ctx.program(ctx.quadVS, BRIGHT_FS);
            var pBlur = ctx.program(ctx.quadVS, BLUR_FS);
            var texA = null, texB = null, fboA = null, fboB = null;
            var bw = 0, bh = 0;
            var threshold = params.threshold != null ? params.threshold : 0.5;
            var intensity = params.intensity != null ? params.intensity : 0.85;

            function blurTo(dirX, dirY) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
                gl.viewport(0, 0, bw, bh);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texA);
                gl.useProgram(pBlur);
                gl.uniform1i(pBlur.u.uTex, 0);
                gl.uniform2f(pBlur.u.uDir, dirX, dirY);
                ctx.blitQuad(pBlur);
                var tt = texA; texA = texB; texB = tt;
                var ff = fboA; fboA = fboB; fboB = ff;
            }

            return {
                post: function () {
                    if (!texA) return;
                    gl.disable(gl.BLEND);
                    // 亮部提取：写 fboB（附件即 texB），随后成对交换保持一致
                    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
                    gl.viewport(0, 0, bw, bh);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, ctx.sceneTex);
                    gl.useProgram(pBright);
                    gl.uniform1i(pBright.u.uScene, 0);
                    gl.uniform1f(pBright.u.uThreshold, threshold);
                    ctx.blitQuad(pBright);
                    var tt = texA; texA = texB; texB = tt;
                    var ff = fboA; fboA = fboB; fboB = ff;

                    blurTo(2.0 / bw, 0);
                    blurTo(0, 2.0 / bh);
                },
                additive: function () {
                    return texA ? { tex: texA, intensity: intensity } : null;
                },
                resize: function (pw, ph) {
                    var nw = Math.max(2, Math.round(pw / 4));
                    var nh = Math.max(2, Math.round(ph / 4));
                    if (nw === bw && nh === bh) return;
                    if (texA) {
                        gl.deleteTexture(texA); gl.deleteTexture(texB);
                        gl.deleteFramebuffer(fboA); gl.deleteFramebuffer(fboB);
                    }
                    bw = nw; bh = nh;
                    texA = ctx.makeTex(bw, bh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR);
                    texB = ctx.makeTex(bw, bh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR);
                    fboA = ctx.makeFbo(texA);
                    fboB = ctx.makeFbo(texB);
                },
                setEnabled: function () {},
                setParam: function (id, value) {
                    if (id === 'threshold') threshold = Number(value) || 0.5;
                    else if (id === 'intensity') intensity = Number(value) || 0.85;
                }
            };
        }
    });
})();
