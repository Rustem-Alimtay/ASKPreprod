import horseshoeIcon from "@assets/horseshoe-icon.png";

interface HorseshoeProps {
  className?: string;
  inverted?: boolean;
}

export function Horseshoe({ className = "", inverted = false }: HorseshoeProps) {
  return (
    <img
      src={horseshoeIcon}
      alt=""
      className={className}
      style={{
        objectFit: "contain",
        filter: inverted
          ? "brightness(0) invert(1)"
          : "brightness(0) invert(0.3)",
      }}
    />
  );
}
