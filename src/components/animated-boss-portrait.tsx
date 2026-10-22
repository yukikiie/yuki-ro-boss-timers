"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motionDetails } from "../../lib/boss-motion";

export function AnimatedBossPortrait({ spriteIndex }: { spriteIndex: number }) {
  const instanceId = useId().replace(/:/g, "");
  const portraitRef = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const details = motionDetails(spriteIndex);

  useEffect(() => {
    const element = portraitRef.current;
    if (!element) return;
    const updateVisibility = () => setDocumentVisible(document.visibilityState !== "hidden");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" });
    if (observer) observer.observe(element);
    else setVisible(true);
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", updateVisibility); };
  }, []);

  if (!details) return null;
  const clipId = `motion-boss-${instanceId}`;
  return <svg ref={portraitRef} className="boss-figure motion-portrait" viewBox={`${details.viewport.left} ${details.viewport.top} ${details.viewport.width} ${details.viewport.height}`} preserveAspectRatio="xMidYMax meet" style={{ overflow: "visible" }} aria-hidden="true" data-motion-boss={details.id} data-motion-action={details.action} data-art-style="pixel" data-portrait-scale={details.opticalScale} data-visible={visible && documentVisible}>
    <defs>{details.frames.map((frame, index) => <clipPath key={index} id={`${clipId}-${index}`} clipPathUnits="userSpaceOnUse"><rect x={frame.offsetLeft} y={frame.offsetTop} width={frame.width} height={frame.height} /></clipPath>)}</defs>
    {details.frames.map((frame, index) => <g key={index} clipPath={`url(#${clipId}-${index})`} className={`motion-frame motion-frame-${index}`} style={{ animationDuration: `${details.duration}s`, animationDelay: `${index ? -(4 - index) * details.duration / 4 : 0}s` }} data-frame={index}>
      <image href={details.source} x={frame.offsetLeft - frame.left} y={frame.offsetTop - frame.top} width={details.width} height={details.height} />
    </g>)}
  </svg>;
}

export function NativeAnimatedBossPortrait({ id, source, stillSource, width, height, stillFrame, paused = false }: { id: string; source: string; stillSource: string; width: number; height: number; stillFrame: { left: number; top: number; width: number; height: number }; paused?: boolean }) {
  const portraitRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const element = portraitRef.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    const updateMotion = () => setReducedMotion(preference.matches);
    updateVisibility();
    updateMotion();
    document.addEventListener("visibilitychange", updateVisibility);
    preference.addEventListener("change", updateMotion);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" });
    if (element) observer?.observe(element);
    if (!observer) setVisible(true);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
      preference.removeEventListener("change", updateMotion);
    };
  }, []);

  const playing = visible && documentVisible && !reducedMotion && !paused;
  return <div ref={portraitRef} className="boss-figure native-motion-portrait" aria-hidden="true" data-native-motion={id} data-native-playing={playing}>
    <span className="native-motion-canvas" style={{ aspectRatio: `${width} / ${height}` }}>
      <img src={playing ? source : stillSource} alt="" width={playing ? width : stillFrame.width} height={playing ? height : stillFrame.height} style={playing ? { left: 0, top: 0, width: "100%", height: "100%" } : { left: `${stillFrame.left / width * 100}%`, top: `${stillFrame.top / height * 100}%`, width: `${stillFrame.width / width * 100}%`, height: `${stillFrame.height / height * 100}%` }} />
    </span>
  </div>;
}
