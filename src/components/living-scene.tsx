"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { SCENE_ASSETS, type ScenePhase } from "../../lib/scene-time";
import { HeaderResidents } from "./garden-creature";

const nightStars = [
  [42, 278], [204, 292], [341, 274], [665, 290], [820, 273],
  [951, 282], [1144, 278], [1262, 304], [1549, 275], [1633, 321],
];

const headerPetals = [
  { left: 66, top: 385, delay: "-1.2s", drift: "64px" },
  { left: 202, top: 412, delay: "-4.8s", drift: "96px" },
  { left: 306, top: 538, delay: "-2.7s", drift: "72px" },
  { left: 96, top: 621, delay: "-6.3s", drift: "82px" },
  { left: 378, top: 488, delay: "-3.7s", drift: "54px" },
];

const gardenPetals = [
  { left: 67, top: 124, delay: "-1.3s", drift: "38px" },
  { left: 655, top: 357, delay: "-5.6s", drift: "-44px" },
  { left: 81, top: 711, delay: "-2.8s", drift: "47px" },
  { left: 657, top: 1028, delay: "-6.5s", drift: "-34px" },
  { left: 109, top: 1392, delay: "-4.2s", drift: "41px" },
  { left: 632, top: 1753, delay: "-0.8s", drift: "-37px" },
  { left: 115, top: 1935, delay: "-3.1s", drift: "36px" },
];

const gardenRipples = [
  { left: 445, top: 64, delay: "-0.6s" },
  { left: 620, top: 279, delay: "-1.1s" },
  { left: 616, top: 507, delay: "-0.2s" },
  { left: 631, top: 686, delay: "-1.5s" },
  { left: 609, top: 1008, delay: "-0.8s" },
  { left: 616, top: 1455, delay: "-1.3s" },
  { left: 648, top: 1768, delay: "-0.4s" },
  { left: 605, top: 1960, delay: "-1.7s" },
];

function useSceneVisibility() {
  const reference = useRef<HTMLDivElement>(null);
  const [intersecting, setIntersecting] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);

  useEffect(() => {
    const element = reference.current;
    const updateDocumentVisibility = () => setDocumentVisible(!document.hidden);
    updateDocumentVisibility();
    document.addEventListener("visibilitychange", updateDocumentVisibility);

    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(
      ([entry]) => setIntersecting(entry?.isIntersecting ?? false),
      { rootMargin: "48px" },
    );

    if (element) observer?.observe(element);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateDocumentVisibility);
    };
  }, []);

  return { reference, visible: intersecting && documentVisible };
}

function PixelPetal({ left, top, delay, drift }: typeof headerPetals[number]) {
  return (
    <g transform={`translate(${left} ${top})`}>
      <g className="scene-motion scene-petal" style={{ "--petal-drift": drift, animationDelay: delay } as CSSProperties}>
        <path d="M0 2h4V0h4v4H6v4H2V6H0Z" fill="#ffd9ed" />
        <path d="M2 2h4v2H2Z" fill="#fff7fa" />
      </g>
    </g>
  );
}

function PixelRipple({ left, top, delay }: { left: number; top: number; delay: string }) {
  return (
    <g transform={`translate(${left} ${top})`}>
      <path
        className="scene-motion scene-ripple"
        style={{ animationDelay: delay }}
        d="M-16 0h8v-3H8v3h8v3H8v3H-8V3h-8Z"
        fill="#e2ffff"
      />
    </g>
  );
}

export function AnimatedHeader({ phase = "day", tall = false, paused = false }: { phase?: ScenePhase; tall?: boolean; paused?: boolean }) {
  const { reference, visible } = useSceneVisibility();
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const identifier = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const waterfallClip = `header-waterfall-${identifier}`;
  const riverClip = `header-river-${identifier}`;

  return (
    <div ref={reference} className="living-scene animated-header" data-header-layout={tall ? "tall" : "standard"} data-scene-phase={phase} data-scene-visible={visible ? "true" : "false"}>
      <img
        className="animated-header-image"
        src={tall ? phase === "day" ? "/art/ro-header-tall-morning.png" : phase === "night" ? "/art/ro-header-tall-night.png" : "/art/ro-header-tall-preview.png" : SCENE_ASSETS[phase].header}
        width={1672}
        height={tall ? 1254 : 941}
        alt={`RO MVP / Mini 重生時間：${phase === "day" ? "早晨柔光" : phase === "afternoon" ? "午後陽光" : "夜晚星空"}的櫻花城堡與波利花園`}
        fetchPriority="high"
      />
      <svg className="scene-motion-layer" viewBox={`0 0 1672 ${tall ? 1254 : 941}`} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
        <defs>
          <clipPath id={waterfallClip}>
            <path d="M1424 505h66v97l-17 16h-43l-6-18Z" />
          </clipPath>
          <clipPath id={riverClip}>
            <path d="M1364 640h141v53h-141ZM1310 846h146v95h-146Z" />
          </clipPath>
        </defs>
        <g className="scene-night-sky">
          {nightStars.map(([left, top], index) => <g key={`${left}-${top}`} transform={`translate(${left} ${top})`}>
            <path className="scene-motion scene-night-star" style={{ animationDelay: `${index * -0.41}s` }} d="M-2-6h4v4h4v4H2v4h-4V2h-4v-4h4Z" fill="#fff8c2" />
          </g>)}
        </g>
        <g className="scene-sunshine" fill="#fff9bc">
          {[{ left: 417, top: 775 }, { left: 1109, top: 734 }, { left: 1324, top: 656 }].map((glint, index) => <g key={index} transform={`translate(${glint.left} ${glint.top})`}>
            <path className="scene-motion scene-sun-glint" style={{ animationDelay: `${index * -0.79}s` }} d="M-2-9h4v7h7v4H2v7h-4V2h-7v-4h7Z" />
          </g>)}
        </g>
        <g clipPath={`url(#${waterfallClip})`} fill="#dcffff">
          <g className="scene-motion scene-waterfall">
            <path d="M1434 489h5v26h-5ZM1451 513h4v31h-4ZM1470 496h5v22h-5ZM1440 553h4v26h-4ZM1461 577h5v21h-5ZM1480 547h4v28h-4Z" />
          </g>
        </g>
        <g clipPath={`url(#${riverClip})`} fill="#e4ffff">
          <g className="scene-motion scene-stream">
            <path d="M1414 646h22v4h-22ZM1386 674h15v4h-15ZM1462 655h17v4h-17ZM1361 852h20v4h-20ZM1328 886h23v4h-23ZM1414 917h18v4h-18Z" />
          </g>
        </g>
        <PixelRipple left={1454} top={630} delay="-0.5s" />
        <PixelRipple left={1341} top={920} delay="-1.3s" />
        {[{ left: 367, top: 103, delay: "-0.2s" }, { left: 318, top: 145, delay: "-1.6s" }, { left: 1305, top: 103, delay: "-0.9s" }, { left: 1355, top: 144, delay: "-2.3s" }].map((star) => (
          <g key={`${star.left}-${star.top}`} transform={`translate(${star.left} ${star.top})`}>
            <path className="scene-motion scene-star" style={{ animationDelay: star.delay }} d="M-3-13h6v10h10v6H3v10h-6V3h-10v-6h10Z" fill="#fffad4" />
          </g>
        ))}
        <g transform="translate(1516 350)">
          <g className="scene-motion scene-propeller">
            <path d="M-3-12h6v9h9v6H3v9h-6V3h-9v-6h9Z" fill="#ffe0ef" stroke="#29225c" strokeWidth="2" />
            <rect x="-2" y="-11" width="4" height="5" fill="#f39bc3" />
          </g>
          <rect x="-2" y="-2" width="4" height="4" fill="#fff5d4" />
        </g>
        {headerPetals.map((petal) => <PixelPetal key={`${petal.left}-${petal.top}`} {...petal} />)}
        <g transform={tall ? "translate(0 -76)" : undefined}>
          <HeaderResidents phase={phase} active={visible && !paused && !reducedMotion} tall={tall} />
        </g>
      </svg>
    </div>
  );
}

export function LivingGarden({ phase = "day" }: { phase?: ScenePhase }) {
  const { reference, visible } = useSceneVisibility();

  return (
    <div ref={reference} className="living-scene living-garden" data-scene-phase={phase} data-scene-visible={visible ? "true" : "false"} aria-hidden="true">
      <svg className="scene-motion-layer" viewBox="0 0 739 2129" preserveAspectRatio="none" focusable="false" shapeRendering="crispEdges">
        {gardenRipples.map((ripple) => <PixelRipple key={`${ripple.left}-${ripple.top}`} {...ripple} />)}
        {gardenPetals.map((petal) => <PixelPetal key={`${petal.left}-${petal.top}`} {...petal} />)}
        {[{ left: 591, top: 208 }, { left: 595, top: 403 }, { left: 614, top: 603 }, { left: 606, top: 913 }, { left: 637, top: 1768 }].map((water, index) => (
          <g key={`${water.left}-${water.top}`} transform={`translate(${water.left} ${water.top})`}>
            <g className="scene-motion scene-garden-water" style={{ animationDelay: `${index * -0.23}s` }} fill="#dcffff">
              <path d="M0 0h3v15H0ZM9 9h3v14H9ZM-7 18h3v10h-3Z" />
            </g>
          </g>
        ))}
        {[{ left: 33, top: 501 }, { left: 702, top: 834 }, { left: 51, top: 1194 }, { left: 687, top: 1572 }, { left: 42, top: 1914 }].map((light, index) => (
          <g key={`${light.left}-${light.top}`} transform={`translate(${light.left} ${light.top})`}>
            <path className="scene-motion scene-firefly" style={{ animationDelay: `${index * -1.4}s` }} d="M-2-5h4v3h3v4H2v3h-4V2h-3v-4h3Z" fill="#fff4b4" />
          </g>
        ))}
      </svg>
    </div>
  );
}
