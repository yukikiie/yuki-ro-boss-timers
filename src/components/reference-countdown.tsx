import type { CSSProperties } from "react";

const glyphPaths: Record<string, string> = {
  "0": "M3 0H13L16 3V25L13 28H3L0 25V3ZM5 5V23H11V5Z",
  "1": "M5 0H11V23H16V28H0V23H6V7H1V3Z",
  "2": "M0 0H16V16H5V23H16V28H0V11H11V5H0Z",
  "3": "M0 0H13L16 3V11L13 14L16 17V25L13 28H0V23H11V17H4V11H11V5H0Z",
  "4": "M0 0H5V11H10V0H15V28H10V17H0Z",
  "5": "M0 0H16V5H5V11H16V28H0V23H11V16H0Z",
  "6": "M3 0H15V5H5V11H13L16 14V25L13 28H3L0 25V3ZM5 16V23H11V16Z",
  "7": "M0 0H16V6L9 28H3L10 5H0Z",
  "8": "M3 0H13L16 3V11L13 14L16 17V25L13 28H3L0 25V17L3 14L0 11V3ZM5 5V11H11V5ZM5 17V23H11V17Z",
  "9": "M3 0H13L16 3V25L13 28H1V23H11V17H3L0 14V3ZM5 5V12H11V5Z",
  ":": "M0 7H5V12H0ZM0 20H5V25H0Z",
  "-": "M0 12H16V17H0Z",
};

export function ReferenceCountdown({ value, decorative = false }: { value: string; decorative?: boolean }) {
  const characters = Array.from(value);
  if (characters.some((character) => !glyphPaths[character])) {
    return <span className="reference-countdown reference-countdown-fallback" aria-hidden={decorative || undefined}>{value}</span>;
  }
  return <span className="reference-countdown" role={decorative ? undefined : "img"} aria-label={decorative ? undefined : value} aria-hidden={decorative || undefined}>
    {characters.map((character, index) => {
      const width = character === ":" ? 5 : 16;
      return <svg key={index} className="reference-countdown-glyph" style={{ "--glyph-width": width } as CSSProperties} viewBox={`0 0 ${width} 28`} width={width} height="28" shapeRendering="crispEdges" aria-hidden="true" focusable="false"><path d={glyphPaths[character]} fillRule="evenodd" /></svg>;
    })}
  </span>;
}
