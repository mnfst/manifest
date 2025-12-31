import { Spinner } from "@/components/ui/shadcn-io/spinner";
import "@/index.css";

import { mountWidget } from "skybridge/web";
import { useCallTool, useToolInfo } from "../helpers";

const typesSvgs = {
  bug: "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/bug.svg",
  dark: "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/dark.svg",
  dragon:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/dragon.svg",
  electric:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/electric.svg",
  fairy:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/fairy.svg",
  fighting:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/fighting.svg",
  fire: "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/fire.svg",
  flying:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/flying.svg",
  ghost:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/ghost.svg",
  grass:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/grass.svg",
  ground:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/ground.svg",
  ice: "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/ice.svg",
  normal:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/normal.svg",
  poison:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/poison.svg",
  psychic:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/psychic.svg",
  rock: "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/rock.svg",
  steel:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/steel.svg",
  water:
    "https://raw.githubusercontent.com/partywhale/pokemon-type-icons/refs/heads/main/icons/water.svg",
};

const typesToClassnames: Record<
  string,
  {
    background: {
      widget: string;
      tiles: string;
    };
    text: string;
  }
> = {
  bug: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  dark: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  dragon: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  electric: {
    background: { widget: "bg-yellow-100", tiles: "bg-yellow-50" },
    text: "text-yellow-600",
  },
  fairy: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  fighting: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  fire: {
    background: { widget: "bg-orange-100", tiles: "bg-orange-50" },
    text: "text-orange-600",
  },
  flying: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  ghost: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  grass: {
    background: { widget: "bg-green-100", tiles: "bg-green-50" },
    text: "text-green-600",
  },
  ground: {
    background: { widget: "bg-[#D7CCC8]", tiles: "bg-[#EFEBE9]" },
    text: "text-[#6D4C41]",
  },
  ice: {
    background: { widget: "bg-blue-100", tiles: "bg-blue-50" },
    text: "text-blue-600",
  },
  normal: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  poison: {
    background: { widget: "bg-purple-100", tiles: "bg-purple-50" },
    text: "text-purple-600",
  },
  psychic: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  rock: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  steel: {
    background: { widget: "bg-gray-100", tiles: "bg-gray-50" },
    text: "black",
  },
  water: {
    background: { widget: "bg-blue-100", tiles: "bg-blue-50" },
    text: "text-blue-600",
  },
};

function Pokemon() {
  const toolInfo = useToolInfo<"pokemon">();

  const pokemon = toolInfo.output ?? null;

  const { callTool: captureTool } = useCallTool("capture");

  if (!pokemon) {
    return (
      <div className="flex justify-center items-center h-50">
        <Spinner />
      </div>
    );
  }

  return (
    <div
      className={`p-4 rounded-xl flex flex-row gap-4 ${typesToClassnames[pokemon.types[0].id].background.widget}`}
    >
      <img
        src={pokemon.imageUrl}
        alt={pokemon.name}
        className="object-contain drop-shadow-2xl"
      />
      <div className="flex flex-col gap-2">
        <Tile color={pokemon.types[0].id}>
          <div className="flex flex-row justify-between items-center">
            <div>
              <h2 className="text-lg font-bold uppercase">{pokemon.name}</h2>
              <h2
                className={`text-md font-bold ${typesToClassnames[pokemon.types[0].id].text}`}
              >
                {String(pokemon.order).padStart(3, "0")}
              </h2>
            </div>
            <div className="flex flex-row gap-2">
              {pokemon.types.map(({ id, name }) => (
                <img
                  key={id}
                  src={typesSvgs[id as keyof typeof typesSvgs]}
                  alt={name}
                  className="w-6 h-6"
                />
              ))}
            </div>
          </div>
          <p className="text-gray-500">{pokemon.description}</p>
          <button
            type="button"
            onClick={() => captureTool({})}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Capture Pokemon
          </button>
        </Tile>
      </div>
    </div>
  );
}

const Tile = ({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) => {
  return (
    <div
      className={`p-4 rounded-xl ${typesToClassnames[color].background.tiles}`}
    >
      {children}
    </div>
  );
};

export default Pokemon;

mountWidget(<Pokemon />);
