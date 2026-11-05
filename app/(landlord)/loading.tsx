import { ListPageSkeleton } from "@/components/landlord/list-skeleton";

// The fallback for any landlord page that does not have its own loading.tsx, so tapping a link
// shows a skeleton straight away instead of the old page sitting there until the server answers.
// (It does not cover the layout itself: the very first load still waits on the layout's queries.)
export default function Loading() {
  return <ListPageSkeleton layout="rows" action={false} label="Loading…" />;
}
