import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(date: Date, { short = false }: { short?: boolean } = {}) {
  const suffix = short ? "" : " ago";
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h${suffix}`;
  const days = Math.round(hours / 24);
  return `${days}d${suffix}`;
}
