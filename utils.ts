import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatTaskId = (date: Date) => {
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const hhmm = date.getHours().toString().padStart(2, "0") + date.getMinutes().toString().padStart(2, "0");
  return `${yyyymmdd}-${hhmm}-001`;
};
