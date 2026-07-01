interface LogoProps {
  size?: number;
  showOrbit?: boolean;
  animated?: boolean;
  className?: string;
  variant?: 'default' | 'light';
}

function StaticOrbit({ variant, orbitOpacity }: { variant: 'default' | 'light'; orbitOpacity: number }) {
  return (
    <>
      <circle cx="24" cy="24" r="20" stroke="#3B6A99" strokeWidth="1.5" strokeOpacity={0.35 * orbitOpacity} />
      <path d="M 24 4 A 20 20 0 0 1 42 28" stroke="#3B6A99" strokeWidth="2" strokeLinecap="round" fill="none" opacity={orbitOpacity} />
      <path d="M 42 28 A 20 20 0 0 1 10 38" stroke="#7ED321" strokeWidth="2" strokeLinecap="round" fill="none" opacity={orbitOpacity} />
      <path d="M 10 38 A 20 20 0 0 1 24 4" stroke={variant === 'light' ? '#fff' : '#0D1F3D'} strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity={0.4} />
      <circle cx="24" cy="4" r="3" fill="#3B6A99" opacity={orbitOpacity} />
      <circle cx="42" cy="28" r="3" fill="#7ED321" opacity={orbitOpacity} />
      <circle cx="10" cy="38" r="3" fill={variant === 'light' ? '#fff' : '#0D1F3D'} fillOpacity={0.6} />
    </>
  );
}

function AnimatedOrbit({ variant, orbitOpacity }: { variant: 'default' | 'light'; orbitOpacity: number }) {
  return (
    <>
      <circle cx="24" cy="24" r="20" stroke="#3B6A99" strokeWidth="1.5" strokeOpacity={0.35 * orbitOpacity} />
      <path d="M 24 4 A 20 20 0 0 1 42 28" stroke="#3B6A99" strokeWidth="2" strokeLinecap="round" fill="none" opacity={orbitOpacity * 0.85} />
      <path d="M 10 38 A 20 20 0 0 1 24 4" stroke={variant === 'light' ? '#fff' : '#0D1F3D'} strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity={0.35} />
      <circle cx="24" cy="4" r="3" fill="#3B6A99" opacity={orbitOpacity} />
      <circle cx="10" cy="38" r="3" fill={variant === 'light' ? '#fff' : '#0D1F3D'} fillOpacity={0.5} />
      <g transform="translate(24 24)">
        <g className="logo-orbit-spin">
          <path d="M 0 -20 A 20 20 0 0 1 17.32 10" stroke="#7ED321" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity={orbitOpacity} />
          <circle cx="17.32" cy="10" r="3" fill="#7ED321" opacity={orbitOpacity} />
        </g>
      </g>
    </>
  );
}

export function LogoMark({
  size = 40,
  showOrbit = true,
  animated = false,
  className = '',
  variant = 'default',
}: LogoProps) {
  const dFill = variant === 'light' ? '#FFFFFF' : '#0D1F3D';
  const orbitOpacity = variant === 'light' ? 0.5 : 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`logo-mark ${animated ? 'logo-mark--animated' : ''} ${className}`}
      aria-hidden="true"
    >
      {showOrbit && (
        animated
          ? <AnimatedOrbit variant={variant} orbitOpacity={orbitOpacity} />
          : <StaticOrbit variant={variant} orbitOpacity={orbitOpacity} />
      )}
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fill={dFill}
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fontWeight="700"
        fontSize="22"
      >
        D
      </text>
    </svg>
  );
}

interface LogoTextProps {
  variant?: 'full' | 'short';
  className?: string;
}

export function LogoText({ variant = 'short', className = '' }: LogoTextProps) {
  if (variant === 'full') {
    return (
      <span className={`logo-text logo-text--full ${className}`}>
        <span className="logo-text__primary">Digital</span>
        <span className="logo-text__secondary">-органайзер</span>
      </span>
    );
  }
  return (
    <span className={`logo-text logo-text--short ${className}`}>
      <span className="logo-text__primary">D</span>
      <span className="logo-text__secondary">-органайзер</span>
    </span>
  );
}

interface LogoFullProps extends LogoTextProps {
  size?: number;
  layout?: 'horizontal' | 'stacked';
  animated?: boolean;
}

export function Logo({ variant = 'short', size = 36, layout = 'horizontal', animated = false, className = '' }: LogoFullProps) {
  if (layout === 'stacked') {
    return (
      <div className={`logo logo--stacked ${className}`}>
        <LogoMark size={size * 1.4} animated={animated} />
        <LogoText variant={variant} />
      </div>
    );
  }
  return (
    <div className={`logo logo--horizontal ${className}`}>
      <LogoMark size={size} animated={animated} />
      <LogoText variant={variant} />
    </div>
  );
}
