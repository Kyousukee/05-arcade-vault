/**
 * Formato de contraseña en cliente. Espeja lo que Supabase Auth exige
 * (mínimo 8 caracteres, con minúscula, mayúscula, dígito y símbolo), pero la
 * autoridad sigue siendo Supabase: esto es solo UX de formulario.
 */
export const PASSWORD_MIN_LENGTH = 8;
/** Requisitos de contraseña, en el orden en que se muestran al usuario. */
export type PasswordRuleId = "length" | "lowercase" | "uppercase" | "digit" | "symbol";
export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  test: (value: string) => boolean;
};
export type PasswordCheck = {
  /** `true` solo si pasan las cinco reglas. */
  valid: boolean;
  /** Reglas incumplidas, en el orden de `PASSWORD_RULES`. */
  failed: PasswordRuleId[];
};
// `symbol` = cualquier carácter que no sea [A-Za-z0-9] ni espacio en blanco;
// es el conjunto que Supabase acepta con `password_required_characters`.
const SYMBOL_PATTERN = /[^A-Za-z0-9\s]/;
/** Las reglas se evalúan sobre el valor sin recortar, igual que en Supabase. */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  { id: "lowercase", label: "Una letra minúscula", test: (value) => /[a-z]/.test(value) },
  { id: "uppercase", label: "Una letra mayúscula", test: (value) => /[A-Z]/.test(value) },
  { id: "digit", label: "Un número", test: (value) => /[0-9]/.test(value) },
  {
    id: "symbol",
    label: "Un símbolo (por ejemplo !?#$)",
    test: (value) => SYMBOL_PATTERN.test(value),
  },
];
/** Detalle de qué requisitos faltan, no solo un booleano. */
export function checkPassword(value: string): PasswordCheck {
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.id);
  return { valid: failed.length === 0, failed };
}
