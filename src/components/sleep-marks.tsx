export function SleepMarks() {
  return <svg className="sleep-marks" viewBox="0 0 64 48" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <g className="sleep-zzz" fill="#c5dcff" stroke="#32325e" strokeWidth="1">
      <path d="M4 23h12v3l-7 8h7v3H4v-3l7-8H4Z" />
      <path d="M21 11h14v4l-9 10h9v4H21v-4l9-10h-9Z" />
      <path d="M41 0h17v4L47 17h11v4H41v-4L52 4H41Z" />
    </g>
  </svg>;
}

export function SleepBubble() {
  return <g className="sleep-bubble">
    <path d="M0 31h4v-5h5v-6H7V9h3V5h5V2h9v3h4v4h3v12h-3v4h-6v3H10v3Z" fill="#c5f4ff" fillOpacity=".66" stroke="#efffff" strokeWidth="1.3" />
    <path d="M13 7h8v2h-8ZM10 11h3v6h-3Z" fill="#fff" />
  </g>;
}
