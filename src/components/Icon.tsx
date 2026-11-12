// Small stroke icons with slightly uneven lines so they feel drawn rather than printed.

const PATHS = {
  pen: 'M4 20l1.2-4.6L16.6 4a2 2 0 0 1 2.9 0l.6.6a2 2 0 0 1 0 2.8L8.7 18.8 4 20zM14.5 6.2l3.3 3.3M5.4 15.6c1.4.4 2.4 1.4 2.9 2.9',
  repeat: 'M17.5 3.8l2.6 2.6-2.6 2.5M3.9 11.4c0-2.8 2.2-5 5-5h11.1M6.4 20.2l-2.6-2.6 2.6-2.5M20.1 12.6c0 2.8-2.2 5-5 5H4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  back: 'M10.2 5.2L3.6 12l6.7 6.8M4.2 12.1h16.2',
  prev: 'M15 4.8L7.8 12l7.3 7.2',
  next: 'M9 4.8l7.2 7.3L8.9 19.2',
  close: 'M5.5 5.3l13 13.2M18.6 5.4L5.4 18.6',
  plus: 'M12 4.5v15.1M4.4 12.1h15.2',
  trash: 'M4.5 6.6h15M9.4 6.4V4.2h5.3v2.2M6.4 6.7l1 13.1h9.3l1-13.1M10 10.5l.3 5.8M14 10.5l-.3 5.8',
  pause: 'M8.6 5.2v13.7M15.4 5.1v13.8',
  play: 'M7.2 4.8v14.5l11.6-7.3-11.6-7.2z',
  download: 'M12 3.9v11.6M7.3 11.1l4.7 4.6 4.7-4.7M4.6 19.8h14.8',
  upload: 'M12 16V4.5M7.3 9l4.7-4.7L16.7 9M4.6 19.8h14.8',
  check: 'M4.6 12.7l4.6 4.6L19.6 6.6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, title }: { name: IconName; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
