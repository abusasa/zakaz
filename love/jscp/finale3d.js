(function () {
    'use strict';

    const FL = 1100;
    const CARD_COUNT = 24;
    const GALAXY_COLORS = ['#ff69b4', '#ff9ec7', '#ffd1dc', '#ffe4b5', '#ffffff'];
    const FIREWORK_COLORS = ['#ff69b4', '#ff1493', '#ffd1dc', '#ffe4b5', '#ff9ec7', '#ffffff'];

    let active = false;
    let uniqueUrls = [];
    let currentMode = 'heart';

    let canvasEl = null;
    let ctx = null;
    let stageEl = null;
    let worldEl = null;
    let captionEl = null;
    let controlsEl = null;
    let hintEl = null;
    let lightboxEl = null;
    let lightboxImgEl = null;
    let lightboxCounterEl = null;

    let cards = [];
    let galaxyParticles = [];
    let heartParticles = [];
    let fireworks = [];

    let rotY = 0;
    let rotX = -6;
    let velY = 0;
    let velX = 0;
    let isDragging = false;
    let activePointerId = null;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let dragDistance = 0;
    let downCardEl = null;
    let lastInteractionTime = 0;

    let lightboxOpen = false;
    let lightboxIndex = 0;
    let lbTouchStartX = 0;
    let lbTouchStartY = 0;

    let rafId = null;
    let timeouts = [];
    let fireworkInterval = null;
    let dpr = 1;
    let viewW = 0;
    let viewH = 0;

    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function addManagedTimeout(fn, delay) {
        const id = setTimeout(fn, delay);
        timeouts.push(id);
        return id;
    }

    function clearAllTimers() {
        for (let i = 0; i < timeouts.length; i++) {
            clearTimeout(timeouts[i]);
        }
        timeouts = [];
        if (fireworkInterval) {
            clearInterval(fireworkInterval);
            fireworkInterval = null;
        }
    }

    function normalizeUrls(urls) {
        const seen = new Set();
        const result = [];
        if (Array.isArray(urls)) {
            for (let i = 0; i < urls.length; i++) {
                const u = urls[i];
                if (typeof u === 'string' && u.trim() !== '' && !seen.has(u)) {
                    seen.add(u);
                    result.push(u);
                }
            }
        }
        return result;
    }

    function buildGalaxyParticles() {
        galaxyParticles = [];
        const spread = Math.max(viewW, viewH) * 0.65;
        const minR = Math.min(viewW, viewH) * 0.22;
        for (let i = 0; i < 180; i++) {
            const arm = i % 3;
            const armOffset = (arm * Math.PI * 2) / 3;
            const t = i / 180;
            const r = minR + t * (spread - minR);
            const theta = t * Math.PI * 6 + armOffset + (Math.random() - 0.5) * 0.7;
            const yJitter = (Math.random() - 0.5) * spread * 0.55;
            galaxyParticles.push({
                x: Math.cos(theta) * r,
                y: yJitter,
                z: Math.sin(theta) * r,
                size: 1.1 + Math.random() * 2.1,
                alpha: 0.35 + Math.random() * 0.55,
                phase: Math.random() * Math.PI * 2,
                speed: 1.2 + Math.random() * 2.2,
                color: GALAXY_COLORS[i % GALAXY_COLORS.length]
            });
        }
    }

    function buildHeartParticles() {
        heartParticles = [];
        const minDim = Math.min(viewW, viewH);
        const baseScale = minDim / 88;
        for (let i = 0; i < 160; i++) {
            const t = (i / 160) * Math.PI * 2;
            const layer = (Math.random() - 0.5) * 2;
            const shell = 0.78 + Math.random() * 0.32;
            const x = 16 * Math.pow(Math.sin(t), 3) * baseScale * shell;
            const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * baseScale * shell;
            const z = layer * baseScale * 4.2 * (0.4 + 0.6 * Math.abs(Math.sin(t)));
            heartParticles.push({
                x: x,
                y: y,
                z: z,
                size: 1.4 + Math.random() * 1.9,
                phase: Math.random() * Math.PI * 2,
                color: i % 5 === 0 ? '#ffe4b5' : (i % 2 === 0 ? '#ff69b4' : '#ffd1dc')
            });
        }
    }

    function spawnFirework(cx3d, cy3d, cz3d, isHeartShape) {
        if (!active) return;
        const minDim = Math.min(viewW, viewH);
        const x0 = cx3d !== undefined ? cx3d : (Math.random() - 0.5) * viewW * 0.55;
        const y0 = cy3d !== undefined ? cy3d : (Math.random() - 0.55) * viewH * 0.45;
        const z0 = cz3d !== undefined ? cz3d : (Math.random() - 0.5) * minDim * 0.4;

        const baseColor = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
        const count = isHeartShape ? 56 : 52;
        const particles = [];
        const speedBase = Math.max(2.6, minDim * 0.0068);

        for (let i = 0; i < count; i++) {
            let vx, vy, vz;
            if (isHeartShape) {
                const t = (i / count) * Math.PI * 2;
                const hx = 16 * Math.pow(Math.sin(t), 3);
                const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
                const norm = speedBase * 0.22;
                vx = hx * norm + (Math.random() - 0.5) * 0.5;
                vy = hy * norm + (Math.random() - 0.5) * 0.5;
                vz = (Math.random() - 0.5) * speedBase * 0.9;
            } else {
                const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
                const theta = Math.PI * (1 + Math.sqrt(5)) * i;
                const spd = speedBase * (0.7 + Math.random() * 0.55);
                vx = Math.sin(phi) * Math.cos(theta) * spd;
                vy = Math.sin(phi) * Math.sin(theta) * spd;
                vz = Math.cos(phi) * spd;
            }

            particles.push({
                x: x0,
                y: y0,
                z: z0,
                vx: vx,
                vy: vy,
                vz: vz,
                trail: [],
                life: 1,
                decay: 0.012 + Math.random() * 0.008,
                size: 1.6 + Math.random() * 1.6,
                color: Math.random() < 0.25 ? '#ffffff' : baseColor
            });
        }

        fireworks.push({ particles: particles });
        if (fireworks.length > 8) {
            fireworks.shift();
        }
    }

    function project3D(x, y, z, cosY, sinY, cosX, sinX, cx, cy) {
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;
        const y1 = y;

        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;
        const x2 = x1;

        const depth = FL - z2;
        if (depth <= 40) return null;

        const scale = FL / depth;
        return {
            sx: cx + x2 * scale,
            sy: cy + y2 * scale,
            scale: scale,
            z: z2
        };
    }

    function updateCanvasSize() {
        if (!canvasEl) return;
        viewW = window.innerWidth;
        viewH = window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvasEl.width = Math.floor(viewW * dpr);
        canvasEl.height = Math.floor(viewH * dpr);
        canvasEl.style.width = viewW + 'px';
        canvasEl.style.height = viewH + 'px';
        if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
    }

    function applyLayout(mode) {
        if (!stageEl || cards.length === 0) return;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const minDim = Math.min(w, h);
        const isCompact = h <= 500 || w <= 768;
        const cardSize = isCompact
            ? Math.max(44, Math.min(58, Math.floor(minDim * 0.14)))
            : Math.max(68, Math.min(88, Math.floor(minDim * 0.11)));

        stageEl.style.setProperty('--card-size', cardSize + 'px');

        if (mode === 'heart') {
            const scale = minDim / 41;
            for (let i = 0; i < cards.length; i++) {
                const t = (i / CARD_COUNT) * Math.PI * 2;
                const x = 16 * Math.pow(Math.sin(t), 3) * scale;
                const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * scale;
                const z = Math.sin(t * 2) * (scale * 4.2) + (i % 2 === 0 ? scale * 2.2 : -scale * 2.2);
                const ry = Math.sin(t) * 22;
                const rx = -Math.cos(t) * 8;

                cards[i].style.transform =
                    'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, ' + z.toFixed(1) + 'px) ' +
                    'rotateY(' + ry.toFixed(1) + 'deg) rotateX(' + rx.toFixed(1) + 'deg) scale(1)';
                cards[i].style.opacity = '1';
                cards[i].style.pointerEvents = 'auto';
            }
        } else if (mode === 'sphere') {
            const R = minDim * 0.35;
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            for (let i = 0; i < cards.length; i++) {
                const yNorm = (1 - (i / (CARD_COUNT - 1)) * 2) * 0.84;
                const rAtY = Math.sqrt(Math.max(0.06, 1 - yNorm * yNorm));
                const theta = goldenAngle * i;
                const x = Math.cos(theta) * rAtY * R;
                const z = Math.sin(theta) * rAtY * R;
                const y = yNorm * R;
                const ry = Math.atan2(x, z) * (180 / Math.PI);
                const rx = -Math.asin(yNorm) * (180 / Math.PI);

                cards[i].style.transform =
                    'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, ' + z.toFixed(1) + 'px) ' +
                    'rotateY(' + ry.toFixed(1) + 'deg) rotateX(' + rx.toFixed(1) + 'deg) scale(0.96)';
                cards[i].style.opacity = '1';
                cards[i].style.pointerEvents = 'auto';
            }
        } else if (mode === 'ring') {
            const ringCount = Math.min(cards.length, uniqueUrls.length || 12);
            const ringR = Math.min(w * 0.34, minDim * 0.56);
            for (let i = 0; i < cards.length; i++) {
                if (i < ringCount) {
                    const angle = (i / ringCount) * Math.PI * 2;
                    const x = Math.sin(angle) * ringR;
                    const z = Math.cos(angle) * ringR;
                    const y = Math.sin(angle * 2) * (minDim * 0.04);
                    const ry = angle * (180 / Math.PI);

                    cards[i].style.transform =
                        'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, ' + z.toFixed(1) + 'px) ' +
                        'rotateY(' + ry.toFixed(1) + 'deg) scale(1.22)';
                    cards[i].style.opacity = '1';
                    cards[i].style.pointerEvents = 'auto';
                } else {
                    cards[i].style.transform = 'translate3d(0px, 0px, 0px) scale(0.01)';
                    cards[i].style.opacity = '0';
                    cards[i].style.pointerEvents = 'none';
                }
            }
        }
    }

    function setMode(mode) {
        if (!active) return;
        if (mode !== 'heart' && mode !== 'sphere' && mode !== 'ring') return;
        currentMode = mode;

        if (controlsEl) {
            const buttons = controlsEl.querySelectorAll('.finale-mode-btn');
            for (let i = 0; i < buttons.length; i++) {
                if (buttons[i].dataset.mode === mode) {
                    buttons[i].classList.add('active');
                } else {
                    buttons[i].classList.remove('active');
                }
            }
        }

        applyLayout(mode);
        spawnFirework(0, -viewH * 0.08, 40, mode === 'heart');
    }

    function updateLightboxContent() {
        if (!lightboxImgEl || !lightboxCounterEl || uniqueUrls.length === 0) return;
        const safeIdx = ((lightboxIndex % uniqueUrls.length) + uniqueUrls.length) % uniqueUrls.length;
        lightboxIndex = safeIdx;
        lightboxImgEl.src = uniqueUrls[safeIdx];
        lightboxCounterEl.textContent = (safeIdx + 1) + ' / ' + uniqueUrls.length;
    }

    function openLightbox(idx) {
        if (!lightboxEl || uniqueUrls.length === 0) return;
        lightboxIndex = idx || 0;
        updateLightboxContent();
        lightboxOpen = true;
        lightboxEl.classList.add('open');
        lightboxEl.setAttribute('aria-hidden', 'false');
    }

    function closeLightbox() {
        if (!lightboxEl) return;
        lightboxOpen = false;
        lightboxEl.classList.remove('open');
        lightboxEl.setAttribute('aria-hidden', 'true');
        lastInteractionTime = performance.now();
    }

    function stepLightbox(delta) {
        if (!lightboxOpen || uniqueUrls.length === 0) return;
        lightboxIndex = (lightboxIndex + delta + uniqueUrls.length) % uniqueUrls.length;
        updateLightboxContent();
    }

    function hideHint() {
        if (hintEl && !hintEl.classList.contains('hidden')) {
            hintEl.classList.add('hidden');
        }
    }

    function onStagePointerDown(e) {
        if (!active || lightboxOpen) return;
        if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;

        isDragging = true;
        activePointerId = e.pointerId;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        dragDistance = 0;
        velY = 0;
        velX = 0;
        downCardEl = e.target && e.target.closest ? e.target.closest('.finale-card') : null;
        lastInteractionTime = performance.now();
    }

    function onWindowPointerMove(e) {
        if (!active || !isDragging || e.pointerId !== activePointerId) return;
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        dragDistance += Math.hypot(dx, dy);

        if (dragDistance > 5) {
            if (stageEl) stageEl.classList.add('dragging');
            hideHint();
        }

        velY = dx * 0.35;
        velX = -dy * 0.25;
        rotY += velY;
        rotX = clamp(rotX + velX, -60, 60);
        lastInteractionTime = performance.now();
    }

    function onWindowPointerUp(e) {
        if (!active || !isDragging || e.pointerId !== activePointerId) return;
        isDragging = false;
        activePointerId = null;
        if (stageEl) stageEl.classList.remove('dragging');
        lastInteractionTime = performance.now();

        if (dragDistance < 8 && downCardEl && !lightboxOpen && downCardEl.style.pointerEvents !== 'none') {
            const idx = parseInt(downCardEl.dataset.photoIdx, 10);
            if (!isNaN(idx)) {
                openLightbox(idx);
            }
        }
        downCardEl = null;
    }

    function onWindowKeyDown(e) {
        if (!active) return;
        if (lightboxOpen) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeLightbox();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                stepLightbox(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                stepLightbox(1);
            }
        }
    }

    function onWindowResize() {
        if (!active) return;
        updateCanvasSize();
        buildGalaxyParticles();
        buildHeartParticles();
        applyLayout(currentMode);
    }

    function renderLoop(now) {
        if (!active) return;

        const tSec = now * 0.001;

        if (!isDragging && !lightboxOpen) {
            rotY += velY;
            rotX = clamp(rotX + velX, -60, 60);
            velY *= 0.94;
            velX *= 0.92;

            const idleElapsed = now - lastInteractionTime;
            if (idleElapsed > 1500) {
                const blend = Math.min(1, (idleElapsed - 1500) / 1000);
                rotY += 0.22 * blend;
                const targetRotX = -6 + Math.sin(tSec * 0.6) * 5;
                rotX += (targetRotX - rotX) * 0.025 * blend;
            }
        }

        if (worldEl) {
            worldEl.style.transform =
                'rotateX(' + rotX.toFixed(2) + 'deg) rotateY(' + rotY.toFixed(2) + 'deg)';
        }
        if (captionEl) {
            captionEl.style.transform =
                'translate(-50%, -50%) rotateY(' + (-rotY).toFixed(2) + 'deg) rotateX(' + (-rotX).toFixed(2) + 'deg)';
        }

        if (ctx) {
            ctx.clearRect(0, 0, viewW, viewH);

            const cx = viewW * 0.5;
            const cy = viewH * 0.5;
            const radY = (rotY * Math.PI) / 180;
            const radX = (rotX * Math.PI) / 180;
            const cosY = Math.cos(radY);
            const sinY = Math.sin(radY);
            const cosX = Math.cos(radX);
            const sinX = Math.sin(radX);

            // 1. 3D-галактика
            for (let i = 0; i < galaxyParticles.length; i++) {
                const gp = galaxyParticles[i];
                const proj = project3D(gp.x, gp.y, gp.z, cosY, sinY, cosX, sinX, cx, cy);
                if (!proj) continue;

                const twinkle = 0.65 + 0.35 * Math.sin(tSec * gp.speed + gp.phase);
                const depthFade = clamp((proj.z + 700) / 1100, 0.15, 1);
                ctx.globalAlpha = gp.alpha * twinkle * depthFade;
                ctx.fillStyle = gp.color;
                ctx.beginPath();
                ctx.arc(proj.sx, proj.sy, Math.max(0.6, gp.size * proj.scale), 0, Math.PI * 2);
                ctx.fill();
            }

            // 2. Пульсирующее 3D-сердце в центре
            const pulse = 1 + 0.045 * Math.sin(tSec * 2.8);
            const heartBaseAlpha = currentMode === 'heart' ? 0.45 : 0.88;
            for (let i = 0; i < heartParticles.length; i++) {
                const hp = heartParticles[i];
                const proj = project3D(
                    hp.x * pulse,
                    hp.y * pulse,
                    hp.z * pulse,
                    cosY, sinY, cosX, sinX, cx, cy
                );
                if (!proj) continue;

                const flicker = 0.7 + 0.3 * Math.sin(tSec * 3.1 + hp.phase);
                ctx.globalAlpha = heartBaseAlpha * flicker;
                ctx.fillStyle = hp.color;
                ctx.beginPath();
                ctx.arc(proj.sx, proj.sy, Math.max(0.8, hp.size * proj.scale), 0, Math.PI * 2);
                ctx.fill();
            }

            // 3. 3D-фейерверки
            for (let f = fireworks.length - 1; f >= 0; f--) {
                const fw = fireworks[f];
                let alive = 0;
                for (let p = 0; p < fw.particles.length; p++) {
                    const pt = fw.particles[p];
                    if (pt.life <= 0) continue;

                    pt.trail.push({ x: pt.x, y: pt.y, z: pt.z });
                    if (pt.trail.length > 3) pt.trail.shift();

                    pt.vx *= 0.982;
                    pt.vy = pt.vy * 0.982 + 0.045;
                    pt.vz *= 0.982;
                    pt.x += pt.vx;
                    pt.y += pt.vy;
                    pt.z += pt.vz;
                    pt.life -= pt.decay;

                    if (pt.life <= 0) continue;
                    alive++;

                    const head = project3D(pt.x, pt.y, pt.z, cosY, sinY, cosX, sinX, cx, cy);
                    if (!head) continue;

                    if (pt.trail.length > 0) {
                        const tail = project3D(
                            pt.trail[0].x, pt.trail[0].y, pt.trail[0].z,
                            cosY, sinY, cosX, sinX, cx, cy
                        );
                        if (tail) {
                            ctx.globalAlpha = pt.life * 0.48;
                            ctx.strokeStyle = pt.color;
                            ctx.lineWidth = Math.max(0.8, pt.size * head.scale * 0.85);
                            ctx.beginPath();
                            ctx.moveTo(tail.sx, tail.sy);
                            ctx.lineTo(head.sx, head.sy);
                            ctx.stroke();
                        }
                    }

                    ctx.globalAlpha = clamp(pt.life, 0, 1);
                    ctx.fillStyle = pt.color;
                    ctx.beginPath();
                    ctx.arc(head.sx, head.sy, Math.max(0.9, pt.size * head.scale), 0, Math.PI * 2);
                    ctx.fill();
                }

                if (alive === 0) {
                    fireworks.splice(f, 1);
                }
            }

            ctx.globalAlpha = 1;
        }

        rafId = requestAnimationFrame(renderLoop);
    }

    function start(urls, options) {
        stop();

        active = true;
        uniqueUrls = normalizeUrls(urls);
        currentMode = 'heart';
        rotY = 0;
        rotX = -6;
        velY = 0;
        velX = 0;
        isDragging = false;
        activePointerId = null;
        lightboxOpen = false;
        lightboxIndex = 0;
        fireworks = [];
        lastInteractionTime = performance.now() - 1200;

        const opts = options || {};
        const captionTopText = opts.captionTop !== undefined ? opts.captionTop : 'С Днём рождения,';
        const captionBottomText = opts.captionBottom !== undefined ? opts.captionBottom : 'любимый! ❤️';

        // 1. Canvas
        canvasEl = document.createElement('canvas');
        canvasEl.id = 'finaleCanvas';
        canvasEl.className = 'finale-canvas';
        document.body.appendChild(canvasEl);
        ctx = canvasEl.getContext('2d');
        updateCanvasSize();
        buildGalaxyParticles();
        buildHeartParticles();

        // 2. 3D Stage & World
        stageEl = document.createElement('div');
        stageEl.id = 'finale3DStage';
        stageEl.className = 'finale-stage';

        worldEl = document.createElement('div');
        worldEl.id = 'finale3DWorld';
        worldEl.className = 'finale-world';

        captionEl = document.createElement('div');
        captionEl.id = 'finaleCenterCaption';
        captionEl.className = 'finale-caption';

        const topSpan = document.createElement('div');
        topSpan.className = 'finale-caption-top';
        topSpan.textContent = captionTopText;

        const bottomSpan = document.createElement('div');
        bottomSpan.className = 'finale-caption-bottom';
        bottomSpan.textContent = captionBottomText;

        captionEl.appendChild(topSpan);
        captionEl.appendChild(bottomSpan);
        worldEl.appendChild(captionEl);

        cards = [];
        const totalUrls = uniqueUrls.length;
        for (let i = 0; i < CARD_COUNT; i++) {
            const card = document.createElement('div');
            card.className = 'finale-card';

            const photoIdx = totalUrls > 0 ? (i % totalUrls) : 0;
            card.dataset.photoIdx = String(photoIdx);
            card.style.transform = 'translate3d(0px, 0px, -420px) scale(0.05)';
            card.style.opacity = '0';

            const front = document.createElement('div');
            front.className = 'finale-card-face front';
            const back = document.createElement('div');
            back.className = 'finale-card-face back';

            if (totalUrls > 0) {
                const url = uniqueUrls[photoIdx];
                const imgFront = document.createElement('img');
                imgFront.src = url;
                imgFront.alt = '';
                imgFront.draggable = false;

                const imgBack = document.createElement('img');
                imgBack.src = url;
                imgBack.alt = '';
                imgBack.draggable = false;

                front.appendChild(imgFront);
                back.appendChild(imgBack);
            }

            card.appendChild(front);
            card.appendChild(back);
            worldEl.appendChild(card);
            cards.push(card);
        }

        stageEl.appendChild(worldEl);
        document.body.appendChild(stageEl);

        // 3. Controls & Hint
        controlsEl = document.createElement('div');
        controlsEl.id = 'finaleControls';
        controlsEl.className = 'finale-controls';

        hintEl = document.createElement('div');
        hintEl.id = 'finaleHint';
        hintEl.className = 'finale-hint';
        hintEl.textContent = 'Покрути пальцем · Нажми на фото';

        const pill = document.createElement('div');
        pill.className = 'finale-pill';

        const modes = [
            { id: 'heart', label: 'Сердце' },
            { id: 'sphere', label: 'Сфера' },
            { id: 'ring', label: 'Кольцо' }
        ];

        for (let m = 0; m < modes.length; m++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'finale-mode-btn' + (modes[m].id === currentMode ? ' active' : '');
            btn.dataset.mode = modes[m].id;
            btn.textContent = modes[m].label;
            btn.addEventListener('click', function () {
                setMode(this.dataset.mode);
            });
            pill.appendChild(btn);
        }

        controlsEl.appendChild(hintEl);
        controlsEl.appendChild(pill);
        document.body.appendChild(controlsEl);

        // 4. Lightbox
        lightboxEl = document.createElement('div');
        lightboxEl.id = 'finaleLightbox';
        lightboxEl.className = 'finale-lightbox';
        lightboxEl.setAttribute('aria-hidden', 'true');

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'finale-lightbox-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', closeLightbox);

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'finale-lightbox-nav prev';
        prevBtn.textContent = '‹';
        prevBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            stepLightbox(-1);
        });

        lightboxImgEl = document.createElement('img');
        lightboxImgEl.id = 'finaleLightboxImg';
        lightboxImgEl.className = 'finale-lightbox-img';
        lightboxImgEl.alt = '';
        lightboxImgEl.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'finale-lightbox-nav next';
        nextBtn.textContent = '›';
        nextBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            stepLightbox(1);
        });

        lightboxCounterEl = document.createElement('div');
        lightboxCounterEl.id = 'finaleLightboxCounter';
        lightboxCounterEl.className = 'finale-lightbox-counter';
        lightboxCounterEl.textContent = '1 / ' + (uniqueUrls.length || 1);

        lightboxEl.appendChild(closeBtn);
        lightboxEl.appendChild(prevBtn);
        lightboxEl.appendChild(lightboxImgEl);
        lightboxEl.appendChild(nextBtn);
        lightboxEl.appendChild(lightboxCounterEl);

        lightboxEl.addEventListener('click', function (e) {
            if (e.target === lightboxEl) {
                closeLightbox();
            }
        });
        lightboxEl.addEventListener('touchstart', function (e) {
            if (e.touches && e.touches.length > 0) {
                lbTouchStartX = e.touches[0].clientX;
                lbTouchStartY = e.touches[0].clientY;
            }
        }, { passive: true });
        lightboxEl.addEventListener('touchend', function (e) {
            if (e.changedTouches && e.changedTouches.length > 0) {
                const dx = e.changedTouches[0].clientX - lbTouchStartX;
                const dy = e.changedTouches[0].clientY - lbTouchStartY;
                if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
                    stepLightbox(dx < 0 ? 1 : -1);
                }
            }
        }, { passive: true });

        document.body.appendChild(lightboxEl);

        // Event bindings
        stageEl.addEventListener('pointerdown', onStagePointerDown);
        window.addEventListener('pointermove', onWindowPointerMove);
        window.addEventListener('pointerup', onWindowPointerUp);
        window.addEventListener('pointercancel', onWindowPointerUp);
        window.addEventListener('keydown', onWindowKeyDown);
        window.addEventListener('resize', onWindowResize);

        // Staggered fly-in animation
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (!active) return;
                for (let i = 0; i < cards.length; i++) {
                    cards[i].style.transitionDelay = (i * 35) + 'ms';
                }
                applyLayout(currentMode);

                addManagedTimeout(function () {
                    for (let i = 0; i < cards.length; i++) {
                        cards[i].style.transitionDelay = '0ms';
                    }
                }, CARD_COUNT * 35 + 1200);
            });
        });

        // Fireworks schedule
        addManagedTimeout(function () {
            spawnFirework(0, -viewH * 0.1, 60, true);
        }, 0);
        addManagedTimeout(function () {
            spawnFirework(-viewW * 0.22, -viewH * 0.14, -40, false);
        }, 450);
        addManagedTimeout(function () {
            spawnFirework(viewW * 0.22, -viewH * 0.12, 40, true);
        }, 950);

        fireworkInterval = setInterval(function () {
            if (!active || lightboxOpen) return;
            spawnFirework(undefined, undefined, undefined, Math.random() < 0.45);
        }, 3200);

        addManagedTimeout(hideHint, 5500);

        rafId = requestAnimationFrame(renderLoop);
    }

    function stop() {
        active = false;
        isDragging = false;
        activePointerId = null;
        downCardEl = null;
        lightboxOpen = false;

        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }

        clearAllTimers();

        window.removeEventListener('pointermove', onWindowPointerMove);
        window.removeEventListener('pointerup', onWindowPointerUp);
        window.removeEventListener('pointercancel', onWindowPointerUp);
        window.removeEventListener('keydown', onWindowKeyDown);
        window.removeEventListener('resize', onWindowResize);

        if (stageEl) {
            stageEl.removeEventListener('pointerdown', onStagePointerDown);
            stageEl.remove();
            stageEl = null;
        }
        if (canvasEl) {
            canvasEl.remove();
            canvasEl = null;
        }
        if (controlsEl) {
            controlsEl.remove();
            controlsEl = null;
        }
        if (lightboxEl) {
            lightboxEl.remove();
            lightboxEl = null;
        }

        worldEl = null;
        captionEl = null;
        hintEl = null;
        lightboxImgEl = null;
        lightboxCounterEl = null;
        ctx = null;
        cards = [];
        galaxyParticles = [];
        heartParticles = [];
        fireworks = [];
    }

    window.Finale3D = {
        start: start,
        stop: stop,
        setMode: setMode,
        isActive: function () {
            return active;
        }
    };
})();
