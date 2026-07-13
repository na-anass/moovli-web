"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, isLocale } from "@/i18n/request";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Persist the chosen UI locale in the `NEXT_LOCALE` cookie that
 * `i18n/request.ts` reads. Called from the account language switcher.
 * Caller is responsible for `router.refresh()` (and any DB write) afterwards.
 */
export async function setLocale(locale: string) {
  const value = isLocale(locale) ? locale : defaultLocale;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, value, {
    maxAge: ONE_YEAR,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
}
