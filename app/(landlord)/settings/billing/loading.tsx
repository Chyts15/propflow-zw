import { ListPageSkeleton } from "@/components/landlord/list-skeleton";

export default function Loading() {
  return <ListPageSkeleton layout="rows" action={false} narrow label="Loading your billing…" />;
}
