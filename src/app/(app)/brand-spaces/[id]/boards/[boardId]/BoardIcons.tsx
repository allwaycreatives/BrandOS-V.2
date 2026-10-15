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
  trash: (
    <svg {...base}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5" /></svg>
  ),
}
