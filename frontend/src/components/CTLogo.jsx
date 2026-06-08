const LOGO_URL = "https://christiantour.ro/tenant/chr/logo.png";

export default function CTLogo({ size = 40, className = "" }) {
  return (
    <img
      src={LOGO_URL}
      alt="Christian Tour"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}
