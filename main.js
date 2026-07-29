/* ============================================================
   STACK - main interaction layer
   Lenis + GSAP ScrollTrigger orchestration, story logo,
   particles, reveals, mobile nav.
   ============================================================ */
import { initStoryLogo } from "./logo3d.js";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const html = document.documentElement;
const body = document.body;
const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);

gsap.registerPlugin(ScrollTrigger);

/* ---------------------------------------------------------
   Preloader
   --------------------------------------------------------- */
function runPreloader() {
  return new Promise((resolve) => {
    const preloader = document.getElementById("preloader");
    const countEl = document.getElementById("preloaderCount");

    const timeout = (ms) => new Promise((res) => setTimeout(res, ms));

    // Only gate on critical above-the-fold assets; lazy-loaded imagery
    // further down the page should not hold up first paint.
    const imgs = Array.from(document.images).filter((img) => img.loading !== "lazy");
    const imgPromises = imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.addEventListener("load", res, { once: true });
            img.addEventListener("error", res, { once: true });
          })
    );
    const fontsReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
    const assetsReady = Promise.race([Promise.all([...imgPromises, fontsReady]), timeout(4000)]);

    function finish() {
      preloader.classList.add("is-hidden");
      setTimeout(() => {
        preloader.remove();
        resolve();
      }, REDUCED_MOTION ? 150 : 700);
    }

    if (REDUCED_MOTION) {
      assetsReady.then(finish);
      return;
    }

    let display = 0;
    const minDuration = 1200;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const timeProgress = Math.min(elapsed / minDuration, 1);
      const target = Math.round(timeProgress * 92);
      if (target > display) display = target;
      if (countEl) countEl.textContent = display;

      if (elapsed >= minDuration) {
        assetsReady.then(() => {
          const settleStart = performance.now();
          function settle(t) {
            const p = Math.min((t - settleStart) / 260, 1);
            display = Math.round(92 + p * 8);
            if (countEl) countEl.textContent = display;
            if (p < 1) requestAnimationFrame(settle);
            else finish();
          }
          requestAnimationFrame(settle);
        });
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/* ---------------------------------------------------------
   Smooth scroll (Lenis) + ScrollTrigger bridge
   --------------------------------------------------------- */
function initSmoothScroll() {
  if (REDUCED_MOTION) return null;

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // Mobile touch must go through Lenis (story pin uses touch-action:none),
    // so exiting the logo beat feels like desktop smooth scroll into Proyectos.
    syncTouch: true,
    syncTouchLerp: 0.085,
    touchMultiplier: 1.15,
    autoRaf: false,
    // Keep page Lenis from eating wheel/touch while the project modal scrolls.
    prevent: (node) => Boolean(node.closest?.("#projectModal")),
  });

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/* ---------------------------------------------------------
   Navigation: scroll state, mobile menu
   --------------------------------------------------------- */
function initNav() {
  const nav = document.getElementById("siteNav");
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      nav.classList.toggle("is-scrolled", self.scroll() > 40);
    },
  });

  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("mobileMenu");
  const panel = menu.querySelector(".mobile-menu__panel");
  const content = menu.querySelector(".mobile-menu__content");
  const links = Array.from(menu.querySelectorAll(".mobile-menu__link"));
  let menuOpen = false;

  menu.inert = true;
  gsap.set(panel, { autoAlpha: 0, y: -8, scale: 0.95 });
  gsap.set(links, { autoAlpha: 0, y: 8 });

  const menuTimeline = gsap.timeline({
    paused: true,
    onReverseComplete: () => {
      menu.classList.remove("is-open");
      menu.inert = true;
      menu.setAttribute("aria-hidden", "true");
    },
  });
  menuTimeline
    .to(panel, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: REDUCED_MOTION ? 0 : 0.42,
      ease: "power3.out",
    })
    .to(
      links,
      {
        autoAlpha: 1,
        y: 0,
        duration: REDUCED_MOTION ? 0 : 0.32,
        stagger: REDUCED_MOTION ? 0 : 0.035,
        ease: "power3.out",
      },
      REDUCED_MOTION ? 0 : 0.07
    );

  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú");
    if (REDUCED_MOTION) {
      menuTimeline.progress(0);
      menu.classList.remove("is-open");
      menu.inert = true;
      menu.setAttribute("aria-hidden", "true");
    } else {
      menuTimeline.reverse();
    }
  }

  function openMenu() {
    menuOpen = true;
    menu.classList.add("is-open");
    toggle.classList.add("is-open");
    menu.inert = false;
    menu.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Cerrar menú");
    menuTimeline.play(0);
  }

  toggle.addEventListener("click", () => {
    menuOpen ? closeMenu() : openMenu();
  });

  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpen) closeMenu();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!menuOpen) return;
    if (panel.contains(event.target) || toggle.contains(event.target)) return;
    closeMenu();
  });

  if (!REDUCED_MOTION && window.matchMedia("(pointer:fine)").matches) {
    const moveX = gsap.quickTo(content, "x", { duration: 0.45, ease: "power3.out" });
    const moveY = gsap.quickTo(content, "y", { duration: 0.45, ease: "power3.out" });

    panel.addEventListener("pointermove", (event) => {
      const rect = panel.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const offsetX = x - 0.5;
      const offsetY = y - 0.5;

      moveX(offsetX * 2.4);
      moveY(offsetY * 1.8);
      panel.style.setProperty("--mx", `${x * 100}%`);
      panel.style.setProperty("--my", `${y * 100}%`);
      panel.style.setProperty("--sx", `${offsetX * -5}px`);
      panel.style.setProperty("--sy", `${10 + offsetY * 3}px`);
    });

    panel.addEventListener("pointerleave", () => {
      moveX(0);
      moveY(0);
      panel.style.setProperty("--mx", "76%");
      panel.style.setProperty("--my", "8%");
      panel.style.setProperty("--sx", "0px");
      panel.style.setProperty("--sy", "10px");
    });
  }
}

/* ---------------------------------------------------------
   Full-page flow-field background
   Vanilla Canvas adaptation of the supplied React component.
   --------------------------------------------------------- */
function initParticles() {
  const canvas = document.getElementById("bgParticles");
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = 1;
  let particles = [];
  let animationFrameId = 0;
  let resizeTimer = 0;

  const mouse = { x: -1000, y: -1000, ready: false };
  const flowMotion = {
    pointerX: 0,
    pointerY: 0,
    pointerTargetX: 0,
    pointerTargetY: 0,
    gustX: 0,
    gustY: 0,
    gustTargetX: 0,
    gustTargetY: 0,
    phaseX: 0,
    phaseY: 0,
  };
  const color = { r: 214, g: 214, b: 222 };
  const trailOpacity = 0.105;
  const speed = 0.78;

  const getParticleCount = () => {
    if (REDUCED_MOTION) return 110;
    if (window.innerWidth <= 600) return 300;
    if (window.innerWidth <= 1024) return 500;
    return 780;
  };

  class FlowParticle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.previousX = this.x;
      this.previousY = this.y;
      this.vx = 0;
      this.vy = 0;
      this.age = 0;
      this.life = Math.random() * 220 + 120;
    }

    update() {
      this.previousX = this.x;
      this.previousY = this.y;

      // Layered trigonometric field creates curved streams without a noise dependency.
      const scale = 0.0045;
      const fieldX = this.x + flowMotion.phaseX;
      const fieldY = this.y + flowMotion.phaseY;
      const waveX = Math.cos(fieldX * scale + Math.sin(fieldY * scale * 0.72));
      const waveY = Math.sin(fieldY * scale - Math.cos(fieldX * scale * 0.68));
      const angle = (waveX + waveY) * Math.PI;

      this.vx += Math.cos(angle) * 0.17 * speed;
      this.vy += Math.sin(angle) * 0.17 * speed;

      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const distanceSquared = dx * dx + dy * dy;
      const interactionRadius = 155;

      if (distanceSquared < interactionRadius * interactionRadius && distanceSquared > 1) {
        const distance = Math.sqrt(distanceSquared);
        const force = (interactionRadius - distance) / interactionRadius;
        this.vx -= (dx / distance) * force * 1.8;
        this.vy -= (dy / distance) * force * 1.8;
      }

      // Cursor motion and the scroll gust translate the whole field, not only
      // particles close to the pointer.
      this.x += this.vx + flowMotion.pointerX + flowMotion.gustX;
      this.y += this.vy + flowMotion.pointerY + flowMotion.gustY;
      this.vx *= 0.95;
      this.vy *= 0.95;
      this.age += 1;

      if (this.age > this.life) {
        this.reset();
        return;
      }

      // Reset at an edge instead of drawing a line across the viewport.
      if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
        this.reset();
      }
    }

    draw() {
      const lifeProgress = this.age / this.life;
      const fade = 1 - Math.abs(lifeProgress - 0.5) * 2;

      ctx.beginPath();
      ctx.moveTo(this.previousX, this.previousY);
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${fade * 0.64})`;
      ctx.lineWidth = 0.76;
      ctx.stroke();
    }
  }

  function initialize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    particles = Array.from({ length: getParticleCount() }, () => new FlowParticle());
  }

  function paintReducedMotionFrame() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    for (let step = 0; step < 24; step += 1) {
      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });
    }
  }

  function animate() {
    // Smoothly follow pointer velocity, then decay when the pointer stops.
    flowMotion.pointerX += (flowMotion.pointerTargetX - flowMotion.pointerX) * 0.14;
    flowMotion.pointerY += (flowMotion.pointerTargetY - flowMotion.pointerY) * 0.14;
    flowMotion.pointerTargetX *= 0.84;
    flowMotion.pointerTargetY *= 0.84;

    // The hero exit drives a much stronger wind impulse.
    flowMotion.gustX += (flowMotion.gustTargetX - flowMotion.gustX) * 0.06;
    flowMotion.gustY += (flowMotion.gustTargetY - flowMotion.gustY) * 0.06;

    // Moving the field coordinates makes its curves reform in a new place.
    flowMotion.phaseX += flowMotion.pointerX * 0.7 + flowMotion.gustX * 0.85;
    flowMotion.phaseY += flowMotion.pointerY * 0.7 + flowMotion.gustY * 0.85;

    ctx.fillStyle = `rgba(0, 0, 0, ${trailOpacity})`;
    ctx.fillRect(0, 0, width, height);

    particles.forEach((particle) => {
      particle.update();
      particle.draw();
    });

    animationFrameId = requestAnimationFrame(animate);
  }

  const handlePointerMove = (event) => {
    if (mouse.ready) {
      const deltaX = event.clientX - mouse.x;
      const deltaY = event.clientY - mouse.y;
      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

      flowMotion.pointerTargetX = clamp(deltaX * 0.13, -4.5, 4.5);
      flowMotion.pointerTargetY = clamp(deltaY * 0.13, -4.5, 4.5);
    }

    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.ready = true;
  };

  const resetPointer = () => {
    mouse.x = -1000;
    mouse.y = -1000;
    mouse.ready = false;
    flowMotion.pointerTargetX = 0;
    flowMotion.pointerTargetY = 0;
  };

  const handleResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      cancelAnimationFrame(animationFrameId);
      initialize();
      if (REDUCED_MOTION) paintReducedMotionFrame();
      else animate();
    }, 120);
  };

  initialize();

  if (REDUCED_MOTION) {
    paintReducedMotionFrame();
  } else {
    animate();
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", resetPointer);
    window.addEventListener("blur", resetPointer);

    let gustSettleTimer = 0;
    ScrollTrigger.create({
      trigger: "#story",
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => {
        const gustStart = 0.08;
        const transitionProgress = Math.min(
          Math.max((self.progress - gustStart) / (1 - gustStart), 0),
          1
        );
        const pulse = Math.pow(Math.sin(transitionProgress * Math.PI), 0.65);
        const direction = self.direction || 1;

        flowMotion.gustTargetX = pulse * 3.4 * direction;
        flowMotion.gustTargetY = pulse * -0.8;

        window.clearTimeout(gustSettleTimer);
        gustSettleTimer = window.setTimeout(() => {
          flowMotion.gustTargetX = 0;
          flowMotion.gustTargetY = 0;
        }, 280);
      },
      onLeave: () => {
        flowMotion.gustTargetX = 0;
        flowMotion.gustTargetY = 0;
      },
      onLeaveBack: () => {
        flowMotion.gustTargetX = 0;
        flowMotion.gustTargetY = 0;
      },
    });
  }

  window.addEventListener("resize", handleResize, { passive: true });
}

/* ---------------------------------------------------------
   Text + fade reveals
   --------------------------------------------------------- */
function prepareTextReveal(el) {
  const html = el.innerHTML;
  const lines = html.split(/<br\s*\/?>/i);
  el.innerHTML = "";
  lines.forEach((line, i) => {
    const lineWrap = document.createElement("span");
    lineWrap.className = "line";
    const inner = document.createElement("span");
    inner.innerHTML = line.trim();
    lineWrap.appendChild(inner);
    el.appendChild(lineWrap);
  });
}

function initReveals() {
  body.classList.add("js-ready");

  document.querySelectorAll("[data-reveal-text]").forEach(prepareTextReveal);

  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;

        if (el.hasAttribute("data-reveal-text")) {
          const spans = el.querySelectorAll(".line > span");
          gsap.to(spans, {
            y: 0,
            duration: 1,
            ease: "power4.out",
            stagger: 0.08,
          });
        } else {
          el.classList.add("is-visible");
        }
        obs.unobserve(el);
      });
    },
    { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
  );

  document.querySelectorAll("[data-reveal],[data-reveal-text]").forEach((el) => {
    io.observe(el);
  });
}

/* ---------------------------------------------------------
   Story logo - pin + scrubbed narrative panels
   --------------------------------------------------------- */
function initStoryScroll(logo, lenis) {
  const section = document.getElementById("story");
  const panels = Array.from(document.querySelectorAll(".story__panel"));
  const heroMeta = section?.querySelector(".story__meta");
  if (!section || !panels.length) return;
  const checkpoints = [0, 0.27, 0.5, 0.73, 1];
  let activeStep = 0;
  let isStepping = false;
  let releaseTimer = 0;
  let touchStartY = null;
  let gestureConsumed = false;

  const activatePanel = (name) => {
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.getAttribute("data-panel") === name);
    });
  };

  const panelForProgress = (progress) => {
    if (progress < 0.2) return null;
    if (progress < 0.34) return "about";
    if (progress < 0.43) return null;
    if (progress < 0.57) return "services";
    if (progress < 0.66) return null;
    if (progress < 0.8) return "why";
    return null;
  };

  activatePanel(REDUCED_MOTION ? "about" : null);

  if (REDUCED_MOTION) {
    logo?.setStoryProgress(1);
    panels.forEach((panel) => panel.classList.add("is-active"));
    return;
  }

  const getBounds = () => {
    const start = section.offsetTop;
    const distance = Math.max(section.offsetHeight - window.innerHeight, 1);
    return { start, end: start + distance, distance };
  };

  const getScrollY = () => (lenis ? lenis.scroll : window.scrollY);

  const closestStep = (progress) =>
    checkpoints.reduce(
      (closest, point, index) =>
        Math.abs(point - progress) < Math.abs(checkpoints[closest] - progress)
          ? index
          : closest,
      0
    );

  const releaseStep = () => {
    isStepping = false;
    window.clearTimeout(releaseTimer);
  };

  document.querySelectorAll("[data-story-progress]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const progress = clampValue(
        Number.parseFloat(link.dataset.storyProgress) || 0,
        0,
        1
      );
      const { start, distance } = getBounds();
      const destination = start + distance * progress;

      activeStep = closestStep(progress);
      isStepping = true;
      releaseTimer = window.setTimeout(releaseStep, 1300);

      if (lenis) {
        lenis.scrollTo(destination, {
          duration: 1,
          easing: (t) => 1 - Math.pow(1 - t, 4),
          lock: true,
          force: true,
          onComplete: releaseStep,
        });
      } else {
        window.scrollTo({ top: destination, behavior: "smooth" });
      }
    });
  });

  const moveOneStep = (direction) => {
    const { start, distance } = getBounds();
    const progress = clampValue((getScrollY() - start) / distance, 0, 1);
    activeStep = closestStep(progress);
    const nextStep = clampValue(activeStep + direction, 0, checkpoints.length - 1);
    if (nextStep === activeStep) return false;

    activeStep = nextStep;
    isStepping = true;
    const destination = start + distance * checkpoints[activeStep];
    releaseTimer = window.setTimeout(releaseStep, 1600);

    if (lenis) {
      lenis.scrollTo(destination, {
        // Same easing/duration as desktop so mobile story beats feel identical.
        duration: 1.15,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        lock: true,
        force: true,
        onComplete: releaseStep,
      });
    } else {
      window.scrollTo({ top: destination, behavior: "smooth" });
    }
    return true;
  };

  const canStepInDirection = (scrollY, direction, start, distance) => {
    const progress = clampValue((scrollY - start) / distance, 0, 1);
    const step = closestStep(progress);
    const nextStep = clampValue(step + direction, 0, checkpoints.length - 1);
    return nextStep !== step;
  };

  window.addEventListener(
    "wheel",
    (event) => {
      if (body.classList.contains("modal-open")) return;
      const { start, end, distance } = getBounds();
      const scrollY = getScrollY();
      const direction = Math.sign(event.deltaY);
      if (!direction || Math.abs(event.deltaY) < 6) return;
      if (scrollY < start - 2 || scrollY > end + 2) return;
      if ((direction < 0 && scrollY <= start + 2) || (direction > 0 && scrollY >= end - 2)) return;
      // Last/first beat: release to Lenis for the same smooth exit as desktop.
      if (!canStepInDirection(scrollY, direction, start, distance)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (!isStepping) moveOneStep(direction);
    },
    { passive: false, capture: true }
  );

  window.addEventListener(
    "keydown",
    (event) => {
      if (body.classList.contains("modal-open")) return;
      const downKeys = ["ArrowDown", "PageDown", " "];
      const upKeys = ["ArrowUp", "PageUp"];
      const direction = downKeys.includes(event.key)
        ? event.shiftKey && event.key === " "
          ? -1
          : 1
        : upKeys.includes(event.key)
          ? -1
          : 0;
      if (!direction) return;

      const { start, end, distance } = getBounds();
      const scrollY = getScrollY();
      if (scrollY < start - 2 || scrollY > end + 2) return;
      if ((direction < 0 && scrollY <= start + 2) || (direction > 0 && scrollY >= end - 2)) return;
      if (!canStepInDirection(scrollY, direction, start, distance)) return;

      event.preventDefault();
      if (!isStepping) moveOneStep(direction);
    },
    { capture: true }
  );

  window.addEventListener(
    "touchstart",
    (event) => {
      touchStartY = event.touches[0]?.clientY ?? null;
      gestureConsumed = false;
    },
    { passive: true, capture: true }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      if (body.classList.contains("modal-open")) return;
      if (touchStartY === null) return;
      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) return;
      // Logo is actively orbiting (horizontal drag) — don't fight it.
      if (document.getElementById("storyCanvasWrap")?.classList.contains("is-dragging")) {
        touchStartY = currentY;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const delta = touchStartY - currentY;
      const direction = Math.sign(delta);
      if (!direction) return;

      const { start, end, distance } = getBounds();
      const scrollY = getScrollY();
      if (scrollY < start - 4 || scrollY > end + 4) return;

      const atStart = scrollY <= start + 4;
      const atEnd = scrollY >= end - 4;
      const leavingStory =
        (direction < 0 && atStart) || (direction > 0 && atEnd);
      const hasStep = canStepInDirection(scrollY, direction, start, distance);

      // Same as desktop: at the story edge, let Lenis own the smooth scroll
      // toward Proyectos (or back to the top) instead of trapping the gesture.
      if (leavingStory || !hasStep) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      // One swipe = one story beat. Fast flicks cannot skip panels.
      if (gestureConsumed || isStepping) return;
      if (Math.abs(delta) >= 32) {
        gestureConsumed = true;
        moveOneStep(direction);
      }
    },
    { passive: false, capture: true }
  );

  window.addEventListener(
    "touchend",
    () => {
      touchStartY = null;
      gestureConsumed = false;
    },
    { passive: true, capture: true }
  );

  window.addEventListener(
    "touchcancel",
    () => {
      touchStartY = null;
      gestureConsumed = false;
    },
    { passive: true, capture: true }
  );

  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    scrub: 0.75,
    onUpdate: (self) => {
      const progress = self.progress;
      logo?.setStoryProgress(progress);
      activatePanel(panelForProgress(progress));
      heroMeta?.classList.toggle("is-hidden", progress > 0.075);
      if (!isStepping) activeStep = closestStep(progress);
    },
  });
}

/* ---------------------------------------------------------
   Featured projects - pinned horizontal gallery
   --------------------------------------------------------- */
function initWork() {
  const section = document.getElementById("work");
  const pin = document.getElementById("workPin");
  const track = document.getElementById("workTrack");
  if (!section || !pin || !track || REDUCED_MOTION) return;

  const media = gsap.matchMedia();
  media.add("(min-width: 0px)", () => {
    const distance = () => Math.max(track.scrollWidth - window.innerWidth, 0);
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance()}`,
        pin,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(track, { clearProps: "transform" });
    };
  });
}

/* ---------------------------------------------------------
   Project modal data - editorial case studies
   --------------------------------------------------------- */
const PROJECTS = [
  {
    id: "sharon",
    category: "Desarrollo",
    year: "2026",
    title: "Sharon Nicole",
    client: "Sharon Nicole",
    overview:
      "Consultora de sueño infantil. Cursos y videollamadas para mejorar el descanso de bebés y niños: rutinas, noches completas y acompañamiento respetuoso.",
    url: "https://sharonnicole.com",
    hero: { src: "img/sharon-cover.png", alt: "Sitio web de Sharon Nicole" },
    gallery: [
      { src: "img/sharon-gallery-01.jpg", alt: "Sección La realidad del sitio de Sharon Nicole", size: "full" },
      { src: "img/sharon-gallery-02.jpg", alt: "Mensaje sobre el sueño infantil en el sitio de Sharon Nicole", size: "full" },
      { src: "img/sharon-gallery-03.jpg", alt: "Cursos y asesorías de Sharon Nicole", size: "full" },
    ],
  },
  {
    id: "caribbean",
    category: "Desarrollo",
    year: "2026",
    title: "Caribbean Buildings Construction",
    client: "Caribbean Buildings Construction",
    overview:
      "Empresa dedicada al diseño y construcción de modernas y lujosas torres residenciales en la República Dominicana.",
    url: "https://caribbeanbuildingsc.com",
    hero: {
      src: "img/caribbean-cover.jpg",
      alt: "Sitio web de Caribbean Buildings Construction en un monitor",
    },
    gallery: [
      {
        src: "img/caribbean-gallery-01.jpg",
        alt: "Cita del sitio: Hacemos realidad grandes visiones arquitectónicas",
        size: "full",
      },
      {
        src: "img/caribbean-gallery-02.jpg",
        alt: "Proyecto Caribbean View en el sitio de Caribbean Buildings",
        size: "full",
      },
      {
        src: "img/caribbean-gallery-03.jpg",
        alt: "Sección Qué hacemos del sitio de Caribbean Buildings",
        size: "full",
      },
      {
        src: "img/caribbean-gallery-04.jpg",
        alt: "Proyecto Edificio Caribbean en el sitio",
        size: "full",
      },
    ],
  },
  {
    id: "abejitas",
    category: "Desarrollo",
    year: "2026",
    title: "Abejitas Veterinaria",
    client: "Abejitas Veterinaria",
    overview:
      "Veterinaria en Santo Domingo. Consultas, vacunas, cirugía, laboratorio y hotel para mascotas.",
    url: "https://abejitasvet.com/",
    hero: { src: "img/abejitas-cover.jpg", alt: "Sitio web de Abejitas Veterinaria presentado en una laptop" },
    gallery: [
      { src: "img/abejitas-gallery-01.jpg", alt: "Sección Por qué elegirnos de Abejitas Veterinaria", size: "full" },
      { src: "img/abejitas-gallery-02.jpg", alt: "Servicios de Abejitas Veterinaria", size: "full" },
      { src: "img/abejitas-gallery-03.jpg", alt: "Guía digital de Abejitas Veterinaria", size: "full" },
    ],
  },
];

/* ---------------------------------------------------------
   Project modal - immersive editorial case-study layer.
   Opens with a FLIP morph from the clicked card, then lets
   visitors step between projects without ever closing.
   --------------------------------------------------------- */
function initProjectModal(lenis) {
  const modal = document.getElementById("projectModal");
  const cards = Array.from(document.querySelectorAll(".work__card"));
  if (!modal || !cards.length) return;

  const canFlip = !REDUCED_MOTION && typeof Flip !== "undefined";
  if (canFlip) gsap.registerPlugin(Flip);

  const backdrop = modal.querySelector(".pm__backdrop");
  const stage = document.getElementById("pmStage");
  const scrollEl = document.getElementById("pmScroll");
  const scrollInner = document.getElementById("pmScrollInner");
  const closeBtn = modal.querySelector(".pm__close");
  const closeTriggers = modal.querySelectorAll("[data-modal-close]");
  const heroFrame = document.getElementById("pmHeroFrame");
  const heroImg = document.getElementById("pmHeroImage");
  const heroCaption = modal.querySelector(".pm__hero-caption");
  const content = modal.querySelector(".pm__content");
  const galleryEl = document.getElementById("pmGallery");
  const categoryEl = document.getElementById("pmCategory");
  const yearEl = document.getElementById("pmYear");
  const titleEl = document.getElementById("pmTitle");
  const overviewEl = document.getElementById("pmOverview");
  const clientEl = document.getElementById("pmClient");
  const servicesEl = document.getElementById("pmServices");
  const technologyEl = document.getElementById("pmTechnology");
  const linkEl = document.getElementById("pmLink");

  const chrome = [heroCaption, content, galleryEl, closeBtn];

  let isOpen = false;
  let lastFocused = null;
  let galleryObserver = null;
  let yearTween = null;
  let modalLenis = null;

  gsap.set(backdrop, { autoAlpha: 0 });
  gsap.set(stage, { autoAlpha: 0 });
  gsap.set(chrome, { autoAlpha: 0 });
  modal.inert = true;

  const heroParallax = gsap.quickTo(heroImg, "y", { duration: 0.45, ease: "power3.out" });

  function ensureModalLenis() {
    if (REDUCED_MOTION || !window.Lenis || !scrollEl || !scrollInner) return null;
    if (modalLenis) return modalLenis;

    modalLenis = new Lenis({
      wrapper: scrollEl,
      content: scrollInner,
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: true,
      touchMultiplier: 1.15,
      autoRaf: false,
      overscroll: false,
    });

    modalLenis.on("scroll", ({ scroll }) => {
      heroParallax(clampValue(scroll * 0.16, -70, 70));
    });

    gsap.ticker.add((time) => {
      if (isOpen) modalLenis?.raf(time * 1000);
    });

    return modalLenis;
  }

  function resetModalScroll() {
    if (modalLenis) {
      modalLenis.scrollTo(0, { immediate: true });
      modalLenis.resize();
    } else {
      scrollEl.scrollTop = 0;
    }
    gsap.set(heroImg, { y: 0 });
  }

  function onNativeScroll() {
    if (modalLenis) return;
    heroParallax(clampValue(scrollEl.scrollTop * 0.16, -70, 70));
  }
  scrollEl.addEventListener("scroll", onNativeScroll, { passive: true });

  function revealTitle() {
    const text = titleEl.textContent;
    titleEl.textContent = "";
    const line = document.createElement("span");
    line.className = "pm__title-line";
    const inner = document.createElement("span");
    inner.textContent = text;
    line.appendChild(inner);
    titleEl.appendChild(line);
    if (REDUCED_MOTION) return;
    gsap.fromTo(
      inner,
      { yPercent: 115 },
      { yPercent: 0, duration: 0.9, ease: "power4.out", delay: 0.15 }
    );
  }

  function animateYear(value) {
    const target = Number.parseInt(value, 10);
    if (Number.isNaN(target) || REDUCED_MOTION) {
      yearEl.textContent = value;
      return;
    }
    yearTween?.kill();
    const obj = { val: target - 5 };
    yearTween = gsap.to(obj, {
      val: target,
      duration: 0.9,
      ease: "power2.out",
      delay: 0.2,
      onUpdate: () => {
        yearEl.textContent = Math.round(obj.val);
      },
    });
  }

  function renderGallery(items) {
    galleryObserver?.disconnect();
    galleryEl.innerHTML = "";
    items.forEach((item) => {
      const figure = document.createElement("figure");
      figure.className = `pm__gallery-item${item.size === "half" ? " pm__gallery-item--half" : ""}`;
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || "";
      img.loading = "lazy";
      figure.appendChild(img);
      galleryEl.appendChild(figure);
    });

    galleryObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { root: scrollEl, threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    galleryEl.querySelectorAll(".pm__gallery-item").forEach((el) => galleryObserver.observe(el));
  }

  function populate(project) {
    categoryEl.textContent = project.category;
    animateYear(project.year);
    titleEl.textContent = project.title;
    revealTitle();
    overviewEl.textContent = project.overview;
    clientEl.textContent = project.client;

    const hasServices = Boolean(project.services?.length);
    servicesEl.textContent = hasServices ? project.services.join(", ") : "";
    servicesEl.closest(".pm__fact").hidden = !hasServices;

    const hasTechnology = Boolean(project.technology?.length);
    technologyEl.textContent = hasTechnology ? project.technology.join(", ") : "";
    technologyEl.closest(".pm__fact").hidden = !hasTechnology;
    heroImg.src = project.hero.src;
    heroImg.alt = project.hero.alt;
    gsap.set(heroImg, { y: 0 });

    if (project.url) {
      linkEl.href = project.url;
      linkEl.hidden = false;
    } else {
      linkEl.removeAttribute("href");
      linkEl.hidden = true;
    }

    renderGallery(project.gallery);
  }

  function openModal(card) {
    if (isOpen) return;
    const project = PROJECTS.find((p) => p.id === card.dataset.projectId);
    if (!project) return;

    lastFocused = document.activeElement;

    populate(project);

    isOpen = true;
    modal.classList.add("is-open");
    modal.inert = false;
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    lenis?.stop();
    ensureModalLenis()?.start();
    resetModalScroll();

    gsap.set(chrome, { autoAlpha: 0, y: 22 });

    if (!canFlip) {
      gsap.set(stage, { autoAlpha: 0, scale: 0.97 });
      gsap.to(stage, { autoAlpha: 1, scale: 1, duration: REDUCED_MOTION ? 0 : 0.55, ease: "power3.out" });
      gsap.to(backdrop, { autoAlpha: 1, duration: REDUCED_MOTION ? 0 : 0.5, ease: "power2.out" });
      gsap.to(chrome, {
        autoAlpha: 1,
        y: 0,
        duration: REDUCED_MOTION ? 0 : 0.55,
        stagger: REDUCED_MOTION ? 0 : 0.05,
        delay: REDUCED_MOTION ? 0 : 0.15,
        ease: "power3.out",
      });
      requestAnimationFrame(() => closeBtn?.focus({ preventScroll: true }));
      return;
    }

    const cardMedia = card.querySelector(".work__media");
    const rect = cardMedia.getBoundingClientRect();

    gsap.set(stage, {
      autoAlpha: 1,
      position: "fixed",
      top: rect.top,
      left: rect.left,
      right: "auto",
      bottom: "auto",
      width: rect.width,
      height: rect.height,
      borderRadius: 4,
    });

    const state = Flip.getState(stage, { props: "borderRadius" });
    gsap.set(stage, { clearProps: "top,left,right,bottom,width,height,position,borderRadius" });

    Flip.from(state, {
      duration: 0.95,
      ease: "power4.inOut",
      onComplete: () => {
        modalLenis?.resize();
        resetModalScroll();
      },
    });

    gsap.to(backdrop, { autoAlpha: 1, duration: 0.75, ease: "power2.out" });
    gsap.to(chrome, {
      autoAlpha: 1,
      y: 0,
      duration: 0.7,
      stagger: 0.06,
      delay: 0.45,
      ease: "power3.out",
      onComplete: () => modalLenis?.resize(),
    });

    requestAnimationFrame(() => closeBtn?.focus({ preventScroll: true }));
  }

  function finishClose() {
    modal.classList.remove("is-open");
    modal.inert = true;
    modal.setAttribute("aria-hidden", "true");
    body.classList.remove("modal-open");
    modalLenis?.stop();
    lenis?.start();
    gsap.set(stage, { clearProps: "scale,opacity,visibility" });
    lastFocused?.focus?.({ preventScroll: true });
  }

  function closeModal() {
    if (!isOpen) return;
    isOpen = false;
    galleryObserver?.disconnect();

    if (REDUCED_MOTION) {
      gsap.set([...chrome, backdrop, stage], { autoAlpha: 0 });
      finishClose();
      return;
    }

    gsap.to(chrome, { autoAlpha: 0, y: 16, duration: 0.32, ease: "power2.in", stagger: 0.02 });
    gsap.to(stage, { scale: 0.94, autoAlpha: 0, duration: 0.5, ease: "power3.inOut", delay: 0.08 });
    gsap.to(backdrop, { autoAlpha: 0, duration: 0.55, ease: "power2.inOut", delay: 0.1, onComplete: finishClose });
  }

  cards.forEach((card) => {
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-haspopup", "dialog");

    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      openModal(card);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openModal(card);
    });
  });

  closeTriggers.forEach((trigger) => trigger.addEventListener("click", closeModal));

  window.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") closeModal();
  });
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */
(async function boot() {
  await runPreloader();

  const lenis = initSmoothScroll();
  const storyLogo = initStoryLogo();

  initNav();
  initParticles();
  initReveals();
  initStoryScroll(storyLogo, lenis);
  initWork();
  initProjectModal(lenis);

  requestAnimationFrame(() => {
    storyLogo?.resize();
    ScrollTrigger.refresh();
  });

  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
