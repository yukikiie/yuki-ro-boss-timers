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
