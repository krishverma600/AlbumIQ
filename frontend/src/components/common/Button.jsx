const styles = {
  primary:
    "inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(124,61,143,0.28)] transition duration-300 hover:-translate-y-1 hover:bg-[var(--primary-dark)] hover:shadow-[0_22px_38px_rgba(111,61,49,0.3)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center rounded-full border border-[rgba(124,61,143,0.14)] bg-white/85 px-5 py-3 text-sm font-semibold text-[var(--text)] transition duration-300 hover:-translate-y-1 hover:border-[rgba(124,61,143,0.3)] hover:bg-white hover:shadow-[0_16px_30px_rgba(87,56,42,0.12)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-[var(--primary)] transition duration-300 hover:-translate-y-0.5 hover:bg-[rgba(124,61,143,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
};

function Button({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}) {
  return (
    <button className={`${styles[variant] || styles.primary} ${className}`} type={type} {...props}>
      {children}
    </button>
  );
}

export default Button;
