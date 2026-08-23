import Biblioteca from "@/components/Biblioteca";
import { getGames } from "@/lib/queries";
export default async function BibliotecaPage() {
  const games = await getGames();
  return <Biblioteca games={games} />;
}
