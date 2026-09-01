import type { User } from "@supabase/supabase-js";
/** Perfil del jugador: un nick único por cuenta. */
export type Profile = {
  id: string;
  nickname: string;
};
export type AuthState = {
  user: User | null;
  /** `null` con `user` no nulo significa cuenta sin nick (OAuth recién entrado). */
  profile: Profile | null;
  loading: boolean;
};
/** Mismo formato que el CHECK de `profiles.nickname`: 3–10 caracteres [A-Z0-9]. */
export const NICKNAME_PATTERN = /^[A-Z0-9]{3,10}$/;
export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 10;
/** Normaliza lo que teclea el usuario antes de validarlo o enviarlo. */
export function normalizeNickname(raw: string): string {
  return raw.trim().toUpperCase().slice(0, NICKNAME_MAX_LENGTH);
}
/** Valida el formato del nick; la verdad última es el CHECK de la base. */
export function isValidNickname(value: string): boolean {
  return NICKNAME_PATTERN.test(value);
}
