import HallOfFame from "@/components/HallOfFame";
import { getAllTopScores, getGames } from "@/lib/queries";
export const revalidate = 60;
export default async function HallOfFamePage() {
  const [games, scoresByGame] = await Promise.all([getGames(), getAllTopScores(12)]);
  return <HallOfFame games={games} scoresByGame={scoresByGame} />;
}
