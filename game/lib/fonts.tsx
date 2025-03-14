import React from 'react';

interface ChewyTextProps {
  children: string;
  size?: number;
  color?: string;
}

export function ChewyText({ children, size = 2, color = "black" }: ChewyTextProps): React.ReactElement {
  return (
    <span 
      style={{ 
        fontFamily: "'Chewy', cursive",
        fontSize: `${size * 16}px`,
        color: color
      }}
    >
      {children}
    </span>
  );
}