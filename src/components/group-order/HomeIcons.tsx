export function HomeIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    pin: (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="7" />
        <path d="m16 16 5 5" />
      </>
    ),
    cart: (
      <>
        <path d="M2 3h3l3 13h11l3-9H6" />
        <circle cx="9" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v11H3Z" />
        <path d="M9 21v-8h6v8" />
      </>
    ),
    menu: (
      <>
        <path d="M5 3h14v19H5Z" />
        <path d="M9 7h6M9 11h6M9 15h6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 20v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5" />
      </>
    ),
    budget: (
      <>
        <path d="M2 6h20v13H2Z" />
        <path d="M5 6a3 3 0 0 1-3 3M19 6a3 3 0 0 0 3 3M5 19a3 3 0 0 0-3-3M19 19a3 3 0 0 1 3-3" />
        <path d="M12 9v7M15 10h-4a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H9" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 3C5 1 1 10 7 17S23 16 20 3Z" />
        <path d="M4 21 17 7M10 15l-1-5M14 11l4 1" />
      </>
    ),
    bowl: (
      <>
        <path d="M2 11h20c-1 8-5 10-10 10S3 19 2 11Z" />
        <path d="M6 7c-3-2 3-3 0-5M12 7c-3-2 3-3 0-5M18 7c-3-2 3-3 0-5" />
      </>
    ),
    flame: (
      <path d="M12 2c1 7 9 7 9 13a9 9 0 0 1-18 0c0-4 3-7 5-9 0 5 3 5 3 7 2-2 1-7 1-11Z" />
    ),
    rice: (
      <>
        <path d="M3 12h18c-1 7-4 10-9 10S4 19 3 12Z" />
        <path d="M5 12C2 6 7 3 10 5c2-5 8-3 8 1 4-1 6 3 2 6M8 7v2M13 5v3M17 9l-2 1" />
      </>
    ),
    mild: (
      <>
        <path d="M12 3c-1 5-7 8-7 13a7 7 0 0 0 14 0c0-5-6-8-7-13Z" />
        <path d="M9 16c0 2 1 3 3 3" />
      </>
    ),
    crispy: (
      <>
        <path d="m3 9 9-6 9 6-3 12H6Z" />
        <path d="m8 9 3 2 5-4M8 16h2M15 16h2" />
      </>
    ),
    arrow: <path d="m9 4 8 8-8 8" />,
    back: <path d="m16 4-8 8 8 8" />,
    close: <path d="m5 5 14 14M19 5 5 19" />,
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.menu}
    </svg>
  );
}
export function FoodIllustration({
  variant = 0,
  noodles = false,
}: {
  variant?: number;
  noodles?: boolean;
}) {
  const colors = ["#f2bc6d", "#c6dca7", "#e6b7a4", "#c9d6e6", "#d6c0a4"];
  return (
    <svg viewBox="0 0 200 150" className="dh-food-art" aria-hidden="true">
      <rect width="200" height="150" fill={colors[variant % colors.length]} />
      <ellipse cx="102" cy="111" rx="63" ry="14" fill="#664b3020" />
      <ellipse cx="100" cy="80" rx="68" ry="54" fill="#fffdf4" />
      <ellipse
        cx="100"
        cy="80"
        rx="56"
        ry="44"
        fill={noodles ? "#dba060" : "#eee0b8"}
      />
      {noodles ? (
        <g stroke="#ffedba" strokeWidth="3" fill="none">
          <path d="M60 70c70-30 70 35 0 20s18-42 67-10-41 32-55-3 65-23 56 8" />
          <path d="M68 64c39-14 62 17 27 32s-56-15-14-26 53 24 26 24" />
        </g>
      ) : (
        <g fill="#fff7dc" stroke="#e4cf9b" strokeWidth="1">
          <ellipse cx="82" cy="75" rx="23" ry="25" />
          <ellipse cx="75" cy="87" rx="23" ry="20" />
        </g>
      )}
      <g fill="#a6bd6b">
        <ellipse
          cx="126"
          cy="59"
          rx="13"
          ry="8"
          transform="rotate(-32 126 59)"
        />
        <ellipse
          cx="143"
          cy="72"
          rx="12"
          ry="8"
          transform="rotate(24 143 72)"
        />
        <ellipse cx="139" cy="91" rx="12" ry="9" />
        <ellipse
          cx="122"
          cy="104"
          rx="14"
          ry="7"
          transform="rotate(26 122 104)"
        />
      </g>
      <g fill="#cc833f" stroke="#e6a858" strokeWidth="3">
        <rect
          x="89"
          y="56"
          width="20"
          height="18"
          rx="3"
          transform="rotate(15 99 65)"
        />
        <rect
          x="99"
          y="77"
          width="22"
          height="18"
          rx="3"
          transform="rotate(-18 110 86)"
        />
        <rect
          x="85"
          y="97"
          width="20"
          height="15"
          rx="3"
          transform="rotate(6 95 104)"
        />
      </g>
      <g fill="#e86d4c">
        <circle cx="60" cy="93" r="6" />
        <circle cx="117" cy="53" r="5" />
      </g>
      <path
        d="m151 26 20 91M160 25l18 91"
        stroke="#94735a"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
