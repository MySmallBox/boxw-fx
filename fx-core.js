// boxw-fx core v1 — BoxWallpaper 特效库骨架
// 职责：GL 工具、渲染管线调度（sim → scene → post → composite）、特效注册表、
//       BwFx.create 门面、BwFx.autoWallpaper 宿主契约胶水。
// 特效模块通过 BwFx.register(id, def) 自注册，本文件不含任何具体特效。
(function (global) {
    'use strict';

    var BwFx = {
        VERSION: '1',
        _defs: {},
        register: function (id, def) { BwFx._defs[id] = def; }
    };

    // ---------- GL 工具 ----------
    function compile(gl, type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error('shader: ' + gl.getShaderInfoLog(s) + '\n' + src);
        }
        return s;
    }

    function program(gl, vsSrc, fsSrc) {
        var p = gl.createProgram();
        gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
        gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            throw new Error('link: ' + gl.getProgramInfoLog(p));
        }
        p.u = {};
        var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (var i = 0; i < n; i++) {
            var name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
            p.u[name] = gl.getUniformLocation(p, name);
        }
        return p;
    }

    function makeTex(gl, w, h, internal, format, type, data, filter) {
        var t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data || null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
    }

    function makeFbo(gl, tex) {
        var f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return f;
    }

    var QUAD_VS = '#version 300 es\n' +
        'in vec2 aPos; out vec2 vUv;' +
        'void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }';

    // 合成：场景 + 可选扭曲（涟漪）+ 可选加色（泛光）+ 暗角。
    // v1 限制：扭曲/加色槽位各一个，多个特效争同一槽位时注册序靠后的生效。
    var COMPOSITE_FS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform sampler2D uScene; uniform sampler2D uDistort; uniform sampler2D uAdd;' +
        'uniform vec2 uTexel; uniform float uDistortOn; uniform float uDistortStrength;' +
        'uniform float uAddOn; uniform float uVignette;' +
        'in vec2 vUv; out vec4 outColor;' +
        'void main(){' +
        '  vec2 uv = vUv;' +
        '  if (uDistortOn > 0.5) {' +
        '    float hl = texture(uDistort, vUv - vec2(uTexel.x, 0.0)).r;' +
        '    float hr = texture(uDistort, vUv + vec2(uTexel.x, 0.0)).r;' +
        '    float hu = texture(uDistort, vUv - vec2(0.0, uTexel.y)).r;' +
        '    float hd = texture(uDistort, vUv + vec2(0.0, uTexel.y)).r;' +
        '    vec2 grad = vec2(hr - hl, hd - hu) * 0.5;' +
        '    uv = clamp(vUv + grad * uDistortStrength, vec2(0.002), vec2(0.998));' +
        '  }' +
        '  vec3 col = texture(uScene, uv).rgb;' +
        '  col += texture(uAdd, vUv).rgb * uAddOn;' +
        '  float v = length(vUv - 0.5);' +
        '  col *= 1.0 - uVignette * v * v;' +
        '  outColor = vec4(col, 1.0);' +
        '}';

    // 无场景绘制特效时的清屏 shader
    var CLEAR_FS = '#version 300 es\n' +
        'precision highp float; uniform vec4 uColor; out vec4 outColor;' +
        'void main(){ outColor = uColor; }';

    // ---------- 渲染器 ----------
    // config: { effects: {id: paramsObj|false}, vignette: 0.28, rtScale: 0.85 }
    function Renderer(canvas, config) {
        var gl = canvas.getContext('webgl2', {
            alpha: false, antialias: false, depth: false, stencil: false,
            powerPreference: 'high-performance'
        });
        if (!gl) { this.unsupported = true; return; }
        this.gl = gl;
        this.canFloat = !!gl.getExtension('EXT_color_buffer_float');
        gl.getExtension('OES_texture_float_linear');
        this.vignette = config.vignette != null ? config.vignette : 0.28;
        this.rtScale = config.rtScale || 0.85;

        var self = this;
        // 特效模块拿到的上下文
        this.ctx = {
            gl: gl,
            program: function (vs, fs) { return program(gl, vs, fs); },
            quadVS: QUAD_VS,
            makeTex: function () { return makeTex.apply(null, [gl].concat([].slice.call(arguments))); },
            makeFbo: function (tex) { return makeFbo(gl, tex); },
            canFloat: this.canFloat,
            get physW() { return self.physW; }, get physH() { return self.physH; },
            get sceneW() { return self.sceneW; }, get sceneH() { return self.sceneH; },
            get sceneTex() { return self.sceneTex; }, get sceneFbo() { return self.sceneFbo; },
            get dpr() { return self.dpr; }, get aspect() { return self.physW / self.physH; }
        };

        this.pComp = program(gl, QUAD_VS, COMPOSITE_FS);
        this.pClear = program(gl, QUAD_VS, CLEAR_FS);

        this.quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        this.quadVao = gl.createVertexArray();
        gl.bindVertexArray(this.quadVao);
        var loc = gl.getAttribLocation(this.pComp, 'aPos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        this.emptyVao = gl.createVertexArray();
        gl.bindVertexArray(null);
        this.ctx.quadVao = this.quadVao;
        this.ctx.emptyVao = this.emptyVao;
        this.ctx.blitQuad = function (p) {
            gl.useProgram(p);
            gl.bindVertexArray(self.quadVao);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        };
        this.blackTex = makeTex(gl, 1, 1, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null, gl.NEAREST);
        this.ctx.blackTex = this.blackTex;

        // 实例化勾选的特效：解析依赖闭包，按 priority 排序
        this.effects = [];
        var want = {};
        var missing = [];
        function need(id) {
            if (want[id] || !BwFx._defs[id]) { if (!BwFx._defs[id]) missing.push(id); return; }
            want[id] = true;
            (BwFx._defs[id].deps || []).forEach(need);
        }
        Object.keys(config.effects || {}).forEach(function (id) {
            if (config.effects[id] === false) return;
            want[id] = true;
            (BwFx._defs[id] ? BwFx._defs[id].deps || [] : []).forEach(need);
            if (!BwFx._defs[id]) missing.push(id);
        });
        if (missing.length) {
            console.warn('[BwFx] 未注册的特效: ' + missing.join(', ') +
                '（可用: ' + Object.keys(BwFx._defs).join(', ') + '）');
        }
        Object.keys(want).forEach(function (id) {
            var def = BwFx._defs[id];
            var inst = def.create(self.ctx, config.effects[id] || {});
            inst.id = id;
            inst.priority = def.priority || 100;
            self.effects.push(inst);
        });
        this.effects.sort(function (a, b) { return a.priority - b.priority; });

        this.physW = 1; this.physH = 1; this.dpr = 1;
    }

    Renderer.prototype.resize = function (logicalW, logicalH, dpr) {
        var gl = this.gl;
        this.dpr = dpr || 1;
        var pw = Math.max(2, Math.round(logicalW * this.dpr));
        var ph = Math.max(2, Math.round(logicalH * this.dpr));
        if (this.physW === pw && this.physH === ph && this.sceneTex) return;
        this.physW = pw; this.physH = ph;
        var c = gl.canvas;
        c.style.width = logicalW + 'px';
        c.style.height = logicalH + 'px';
        c.width = pw; c.height = ph;

        var sw = Math.max(2, Math.round(pw * this.rtScale));
        var sh = Math.max(2, Math.round(ph * this.rtScale));
        if (this.sceneTex) { gl.deleteTexture(this.sceneTex); gl.deleteFramebuffer(this.sceneFbo); }
        this.sceneTex = makeTex(gl, sw, sh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null, gl.LINEAR);
        this.sceneFbo = makeFbo(gl, this.sceneTex);
        this.sceneW = sw; this.sceneH = sh;
        for (var i = 0; i < this.effects.length; i++) {
            if (this.effects[i].resize) this.effects[i].resize(pw, ph, this.dpr);
        }
    };

    Renderer.prototype.setQuality = function (q) {
        var SCALE = { low: 0.6, mid: 0.85, high: 1.0 };
        this.rtScale = SCALE[q] || 0.85;
        for (var i = 0; i < this.effects.length; i++) {
            if (this.effects[i].quality) this.effects[i].quality(q);
        }
        this._forceResize();
    };

    Renderer.prototype._forceResize = function () {
        this.physW = 0;
        if (this.resizeW) this.resize(this.resizeW, this.resizeH, this.dpr);
    };

    Renderer.prototype.frame = function (t, dt, input) {
        var gl = this.gl, i, fx;
        gl.disable(gl.DEPTH_TEST);

        // 1. 模拟 pass（离屏，各特效自己的 ping-pong）
        for (i = 0; i < this.effects.length; i++) {
            fx = this.effects[i];
            if (fx.enabled !== false && fx.sim) fx.sim(t, dt, input);
        }
        if (input.drops) input.drops.length = 0;

        // 2. 场景 pass
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
        gl.viewport(0, 0, this.sceneW, this.sceneH);
        gl.disable(gl.BLEND);
        var drewScene = false;
        for (i = 0; i < this.effects.length; i++) {
            fx = this.effects[i];
            if (fx.enabled !== false && fx.drawScene) { fx.drawScene(t, dt); drewScene = true; }
        }
        if (!drewScene) {
            gl.useProgram(this.pClear);
            gl.uniform4f(this.pClear.u.uColor, 0.02, 0.02, 0.04, 1);
            this.ctx.blitQuad(this.pClear);
        }

        // 3. 后处理 pass（读 sceneTex 写自己的纹理）
        for (i = 0; i < this.effects.length; i++) {
            fx = this.effects[i];
            if (fx.enabled !== false && fx.post) fx.post();
        }

        // 4. 合成到屏幕：distort/additive 槽位由特效申报，先到先得
        var distort = null, add = null;
        for (i = 0; i < this.effects.length; i++) {
            fx = this.effects[i];
            if (fx.enabled === false) continue;
            if (!distort && fx.distort) distort = fx.distort();
            if (!add && fx.additive) add = fx.additive();
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.physW, this.physH);
        var pc = this.pComp;
        gl.useProgram(pc);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
        gl.uniform1i(pc.u.uScene, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, distort ? distort.tex : this.blackTex);
        gl.uniform1i(pc.u.uDistort, 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, add ? add.tex : this.blackTex);
        gl.uniform1i(pc.u.uAdd, 2);
        if (distort) gl.uniform2f(pc.u.uTexel, 1.2 / distort.w, 1.2 / distort.h);
        gl.uniform1f(pc.u.uDistortOn, distort ? 1 : 0);
        gl.uniform1f(pc.u.uDistortStrength, distort ? distort.strength : 0);
        gl.uniform1f(pc.u.uAddOn, add ? add.intensity : 0);
        gl.uniform1f(pc.u.uVignette, this.vignette);
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // ---------- 门面 ----------
    // BwFx.create(canvas, { effects: { particles: {quality:'mid'}, ripple: {}, bloom: {} } })
    BwFx.create = function (canvas, config) {
        var r = new Renderer(canvas, config || {});
        if (r.unsupported) {
            console.warn('[BwFx] WebGL2 不可用，特效库无法启动（需要 WebView2 引擎）');
            return null;
        }
        var api = {
            renderer: r,
            canFloat: r.canFloat,
            frame: function (t, dt, input) { r.frame(t, dt, input); },
            resize: function (w, h, dpr) { r.resizeW = w; r.resizeH = h; r.resize(w, h, dpr); },
            setQuality: function (q) { r.setQuality(q); },
            setParam: function (effectId, paramId, value) {
                for (var i = 0; i < r.effects.length; i++) {
                    if (r.effects[i].id === effectId && r.effects[i].setParam) {
                        r.effects[i].setParam(paramId, value);
                        return true;
                    }
                }
                return false;
            },
            effectIds: function () {
                return r.effects.map(function (e) { return e.id; });
            }
        };
        return api;
    };

    // ---------- autoWallpaper：bw 契约 + 输入汇聚 ----------
    // opts: { hud: 元素id|null, audioDrive: true }
    // 参数路由（bwSetParam 的 id 约定）：
    //   "quality"            → fx.setQuality
    //   "<effect>.<param>"    → fx.setParam(effect, param, value)
    //   "<effect>.enabled"    → 开关特效（含 ripple/bloom 等，关闭即零开销）
    //   "fx.showFps"          → HUD 开关
    BwFx.autoWallpaper = function (fx, opts) {
        opts = opts || {};
        var hud = opts.hud ? document.getElementById(opts.hud) : null;
        var W = 0, H = 0, running = false, animId = null, lastFrame = 0;
        var input = { mx: 0.5, my: 0.5, push: 0, audio: 0, drops: [] };
        var lastMx = -1, lastMy = -1, pushDecay = 0;
        var audioLevel = 0, lastAudioAt = 0;
        var showFps = true, fpsAvg = 60, hudAt = 0;

        function feedMove(x, y) {
            var nx = Math.min(1, Math.max(0, x / W)), ny = Math.min(1, Math.max(0, y / H));
            if (lastMx >= 0) {
                var vlen = Math.hypot(nx - lastMx, ny - lastMy);
                if (vlen > 0.0005) {
                    pushDecay = Math.min(1, pushDecay + vlen * 30);
                    if (vlen > 0.002 && input.drops.length < 8) {
                        input.drops.push({ x: nx, y: 1 - ny, s: Math.min(0.35, vlen * 22) });
                    }
                }
            }
            lastMx = nx; lastMy = ny;
            input.mx = nx; input.my = ny;
        }
        function feedClick(x, y, button) {
            input.drops.push({
                x: Math.min(1, Math.max(0, x / W)),
                y: 1 - Math.min(1, Math.max(0, y / H)),
                s: button === 2 ? -0.5 : 0.55
            });
            pushDecay = 1.5;
        }

        window.bwHandleMouseMove = feedMove;
        window.bwHandleClick = function (x, y, button) { feedClick(x, y, button); return 'ok'; };
        window.bwAudio = function (level) {
            audioLevel = Number(level) || 0;
            lastAudioAt = performance.now();
        };
        // 预览模式（浏览器/预览面板）：原生事件同源
        window.addEventListener('pointermove', function (e) {
            if (W) feedMove(e.clientX, e.clientY);
        });
        window.addEventListener('pointerdown', function (e) {
            if (W) feedClick(e.clientX, e.clientY, e.button === 2 ? 2 : 0);
        });
        window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

        function frame(ts) {
            if (!running) return;
            animId = requestAnimationFrame(frame);
            var dt = Math.min(0.05, (ts - lastFrame) / 1000 || 0.016);
            lastFrame = ts;
            if (dt > 0) fpsAvg += (1 / dt - fpsAvg) * 0.05;

            pushDecay *= Math.pow(0.05, dt);
            input.push = pushDecay * 0.9;
            input.audio = (ts - lastAudioAt < 500) ? audioLevel : audioLevel * Math.pow(0.2, dt);

            fx.frame(ts / 1000, dt, input);

            if (hud && showFps && ts - hudAt > 250) {
                hudAt = ts;
                hud.textContent = Math.round(fpsAvg) + ' fps';
            }
        }

        window.bwStart = function (w, h, dpr) {
            W = w; H = h;
            fx.resize(w, h, dpr || 1);
            if (!running) {
                running = true;
                lastFrame = performance.now();
                animId = requestAnimationFrame(frame);
            }
        };
        window.bwResize = function (w, h) { W = w; H = h; fx.resize(w, h, window.devicePixelRatio || 1); };
        window.bwPause = function () {
            running = false;
            if (animId) { cancelAnimationFrame(animId); animId = null; }
        };
        window.bwResume = function () {
            if (!running) {
                running = true;
                lastFrame = performance.now();
                animId = requestAnimationFrame(frame);
            }
        };
        window.bwStop = function () {
            running = false;
            if (animId) { cancelAnimationFrame(animId); animId = null; }
        };
        window.bwSetParam = function (id, value) {
            if (id === 'quality') { fx.setQuality(String(value)); return; }
            if (id === 'fx.showFps') {
                showFps = value === true || value === 'true';
                if (hud && !showFps) hud.textContent = '';
                return;
            }
            var dot = id.indexOf('.');
            if (dot < 0) return;
            var eff = id.slice(0, dot), par = id.slice(dot + 1);
            if (par === 'enabled') {
                var on = value === true || value === 'true';
                var list = fx.renderer.effects;
                for (var i = 0; i < list.length; i++) {
                    if (list[i].id === eff) {
                        list[i].enabled = on;
                        if (list[i].setEnabled) list[i].setEnabled(on);
                    }
                }
                return;
            }
            fx.setParam(eff, par, value);
        };

        // 纯浏览器打开时自启动兜底（BoxW 宿主会调 bwStart，这里不冲突）
        if (!window.bwHosted) {
            setTimeout(function () {
                if (!running) window.bwStart(window.innerWidth, window.innerHeight,
                    window.devicePixelRatio || 1);
            }, 100);
        }
        window.addEventListener('resize', function () {
            if (running && !window.bwHosted) {
                fx.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
            }
        });
    };

    global.BwFx = BwFx;
})(window);
