import { notFound } from "next/navigation";
import GamePlayer from "@/components/GamePlayer";
import { getGameById } from "@/lib/queries";
export default async function GamePlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();
  return <GamePlayer game={{ id: game.id, title: game.title }} />;
}
