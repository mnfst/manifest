export const getPokemon = async (name: string) => {
  const query = `
      query getPokemon($name: String!, $language: String!) {
        pokemon(where: {name: {_eq: $name} is_default: {_eq: true}}) {
          id
          order
          height
          weight
          pokemonstats {
            base_stat
            stat {
              name
              statnames(where: {language: {name: {_eq: $language}}}, limit: 1) {
                name
              }
            }
          }
          pokemonabilities {
            ability {
              name
              abilitynames(where: {language: {name: {_eq: $language}}}, limit: 1) {
                name
              }
              abilityflavortexts(where: {language: {name: {_eq: $language}}}, limit: 1) {
                flavor_text
              }
            }
          }
          pokemonsprites {
            sprites
          }
          pokemontypes {
            type {
              name
              typenames(where: {language: {name: {_eq: $language}}}, limit: 1) {
                name
              }
            }
          }
          pokemonspecy {
            pokemoncolor {
              name
            }
            evolutionchain {
              pokemonspecies {
                pokemons(where: {is_default: {_eq: true}}) {
                  name
                  order
                  pokemonsprites {
                    sprites
                  }
                }
              }
            }
            pokemonspeciesflavortexts(where: {language: {name: {_eq: $language}}}, limit: 1) {
              flavor_text
            }
          }
        }
      }
    `;

  const response = await fetch("https://graphql.pokeapi.co/v1beta2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { name: name.toLowerCase(), language: "en" },
    }),
  });

  const result = await response.json();
  const pokemon = result.data.pokemon[0] as {
    id: number;
    order: number;
    height: number;
    weight: number;
    pokemonspecy: {
      pokemoncolor: { name: string };
      pokemonspeciesflavortexts: { flavor_text: string }[];
      evolutionchain: {
        pokemonspecies: {
          pokemons: {
            name: string;
            order: number;
            pokemonsprites: { sprites: { front_default: string } }[];
          }[];
        }[];
      };
    };
    pokemonsprites: { sprites: { front_default: string } }[];
    pokemonstats: {
      base_stat: number;
      stat: { name: string; statnames: { name: string }[] };
    }[];
    pokemontypes: {
      type: { name: string; typenames: { name: string }[] };
    }[];
    pokemonabilities: {
      ability: {
        name: string;
        abilitynames: { name: string }[];
        abilityflavortexts: { flavor_text: string }[];
      };
    }[];
  } | null;

  if (!pokemon) {
    throw new Error(`Pokemon ${name} not found`);
  }

  return {
    id: pokemon.id,
    color: pokemon.pokemonspecy.pokemoncolor.name,
    order: pokemon.order,
    heightInMeters: pokemon.height / 10,
    weightInKilograms: pokemon.weight / 10,
    imageUrl: pokemon.pokemonsprites[0].sprites.front_default,
    description: pokemon.pokemonspecy.pokemonspeciesflavortexts[0]?.flavor_text
      .replace(/\n/g, " ")
      .replace(/\.(?![^.]*$)/g, ". "),
    stats: pokemon.pokemonstats.map((stat) => ({
      id: stat.stat.name,
      name: stat.stat.statnames[0].name,
      value: stat.base_stat,
    })),
    types: pokemon.pokemontypes.map((type) => ({
      id: type.type.name,
      name: type.type.typenames[0].name,
    })),
    abilities: pokemon.pokemonabilities.map((ability) => ({
      id: ability.ability.name,
      name: ability.ability.abilitynames[0].name,
      description: ability.ability.abilityflavortexts[0]?.flavor_text
        .replace(/\n/g, " ")
        .replace(/\.(?![^.]*$)/g, ". "),
    })),
    evolutions: pokemon.pokemonspecy.evolutionchain.pokemonspecies.map(
      ({ pokemons: [pokemon] }) => ({
        id: pokemon.name,
        order: pokemon.order,
        imageUrl: pokemon.pokemonsprites[0].sprites.front_default,
      }),
    ),
  };
};
