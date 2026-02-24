import GameCanvas from "@/components/GameCanvas";
import Hud from "@/ui/Hud";
import DebugOverlay from "@/ui/DebugOverlay";

const App = () => {
  return (
    <div className="app">
      <GameCanvas />
      <Hud />
      <DebugOverlay />
    </div>
  );
};

export default App;

