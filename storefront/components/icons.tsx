type IconName = "search" | "user" | "whatsapp" | "hanger" | "pin" | "shield" | "arrow" | "bag" | "minus" | "plus" | "trash" | "check";

export function StoreIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    user: <><circle cx="12" cy="8" r="3.25" /><path d="M5.5 20c.4-4 2.6-6 6.5-6s6.1 2 6.5 6" /></>,
    whatsapp: <><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z" /><path d="M9 8.5c.7 2 2.5 3.8 4.5 4.5" /></>,
    hanger: <><path d="M9.5 6a2.5 2.5 0 1 1 3.6 2.3L20 14v2H4v-2l7-5.7" /></>,
    pin: <><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    shield: <><path d="M12 3 5.5 5.5V11c0 4.2 2.5 7.5 6.5 10 4-2.5 6.5-5.8 6.5-10V5.5L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    minus: <path d="M6 12h12" />,
    plus: <><path d="M6 12h12" /><path d="M12 6v12" /></>,
    trash: <><path d="M4 7h16" /><path d="m9 7 .5-3h5l.5 3" /><path d="m7 7 1 13h8l1-13" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };

  return (
    <svg
      aria-hidden="true"
      className="store-icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      {paths[name]}
    </svg>
  );
}
