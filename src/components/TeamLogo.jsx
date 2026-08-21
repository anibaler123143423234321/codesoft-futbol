import React, { useState } from 'react';

export default function TeamLogo({ 
  src, 
  alt = 'Team', 
  size = 48, 
  className = '', 
  style = {},
  isHome = true 
}) {
  const [hasError, setHasError] = useState(false);

  // Generate 2-3 letter initials from name
  const getInitials = (name) => {
    if (!name) return 'FC';
    const words = name.replace(/CF|FC|CD|UD|SAD|Club|Atlético|Deportivo/gi, '').trim().split(/\s+/);
    if (words.length >= 2 && words[0] && words[1]) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 3).toUpperCase();
  };

  const initials = getInitials(alt);
  const primaryColor = isHome ? '#00d2ff' : '#ff3366';
  const secondaryColor = isHome ? '#0077b6' : '#990033';

  if (!src || hasError) {
    return (
      <div
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          minHeight: `${size}px`,
          borderRadius: '12px',
          background: `linear-gradient(135deg, ${secondaryColor} 0%, #0a0d17 100%)`,
          border: `1.5px solid ${primaryColor}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 12px ${isHome ? 'rgba(0, 210, 255, 0.25)' : 'rgba(255, 51, 102, 0.25)'}`,
          userSelect: 'none',
          ...style
        }}
        title={alt}
      >
        <span
          style={{
            fontFamily: 'var(--font-score)',
            fontSize: `${Math.max(10, Math.floor(size * 0.32))}px`,
            fontWeight: 800,
            letterSpacing: '0.5px',
            color: '#ffffff',
            textShadow: '0 1px 4px rgba(0,0,0,0.8)'
          }}
        >
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4))',
        ...style
      }}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}
