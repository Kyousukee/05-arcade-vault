import Home from "@/components/Home";
import { getAllTopScores, getGames } from "@/lib/queries";
export default async function Page() {
  const [games, scoresByGame] = await Promise.all([getGames(), getAllTopScores(5)]);
  return <Home games={games} scoresByGame={scoresByGame} />;
}
