// Small line icons for the board toolbar (24x24, drawn with the current text colour).
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const Icons = {
  note: (
    <svg {...base}><path d="M5 7h14M5 12h14M5 17h9" /></svg>
  ),
  title: (
    <svg {...base}><path d="M6 6h12M12 6v13M9 19h6" /></svg>
  ),
  todo: (
    <svg {...base}><path d="M4 7l1.6 1.6L8.5 5.5M4 16.5l1.6 1.6 2.9-3.1M12 7h8M12 17h8" /></svg>
  ),
  link: (
    <svg {...base}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
  ),
  image: (
    <svg {...base}><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M20 16l-4.5-4.5L7 19" /></svg>
  ),
  board: (
    <svg {...base}><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></svg>
  ),
  color: (
    <svg {...base}><path d="M12 4c4.4 0 8 3 8 6.6 0 2.4-1.9 3.4-3.7 3.4H15a1.6 1.6 0 0 0-1.2 2.7c.5.6.2 1.5-.6 1.7-.4.1-.8.1-1.2.1C7.6 18.5 4 15.6 4 11.6 4 7.4 7.6 4 12 4z" /><circle cx="8.5" cy="11" r=".9" /><circle cx="12" cy="8" r=".9" /><circle cx="15.5" cy="10" r=".9" /></svg>
  ),
  sketch: (
    <svg {...base}><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1zM14 7l3 3" /></svg>
  ),
  document: (
    <svg {...base}><path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" /></svg>
  ),
  audio: (
    <svg {...base}><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" /></svg>
  ),
  map: (
    <svg {...base}><path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></svg>
  ),
  video: (
    <svg {...base}><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M10 9.5v5l4.5-2.5z" /></svg>
  ),
  table: (
    <svg {...base}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 10h16M4 15h16M10 5v14" /></svg>
  ),
  comment: (
    <svg {...base}><path d="M5 5h14v10h-8.5L6 19v-4H5z" /><path d="M8.5 9h7M8.5 12h4" /></svg>
  ),
  column: (
    <svg {...base}><rect x="6" y="3.5" width="12" height="17" rx="2" /><path d="M6 8.5h12" /></svg>
  ),
  more: (
    <svg {...base} fill="currentColor" stroke="none"><circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" /></svg>
  ),
  line: (
    <svg {...base}><path d="M5 19L19 5M10 5h9v9" /></svg>
  ),
  draw: (
    <svg {...base}><path d="M3 17c2.5-6 4.5-9 6-9s1 5 3 5 3-6 4.5-6S19 14 21 15" /></svg>
  ),
  trash: (
    <svg {...base}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5" /></svg>
  ),
}
