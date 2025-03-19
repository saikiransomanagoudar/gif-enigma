import React from "react";

interface ComicTextProps {
  children: React.ReactNode;
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  glow?: boolean;
  className?: string;
}

export const ComicText: React.FC<ComicTextProps> = ({
  children,
  size = 1,
  color = "#FF5722",
  align = "center",
  glow = false,
  className = "",
}) => {
  const baseSize = 24;
  const fontSize = `${baseSize * size}px`;
  
  const styles: React.CSSProperties = {
    fontFamily: "Comic Sans MS, Comic Sans, cursive",
    fontSize,
    color,
    textAlign: align,
    margin: 0,
    padding: 0,
    textShadow: glow ? `0 0 5px ${color}66, 0 0 10px ${color}44` : "none",
    letterSpacing: "1px",
    fontWeight: "normal",
    lineHeight: 1.2,
  };

  return (
    <div style={styles} className={`chewy-text ${className}`}>
      {children}
    </div>
  );
};

export default ComicText;