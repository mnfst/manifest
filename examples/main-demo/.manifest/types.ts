export interface Pokemon {
  id: string;
  name: string;
  type: 'Fire' | 'Water' | 'Grass' | 'Electric';
  level: number;
  trainer?: Trainer;
}

export interface Trainer {
  id: string;
  name: string;
  isChampion: boolean;
  pokemon?: Pokemon[];
}

export interface CreateUpdatePokemonDto {
  name: string;
  type: 'Fire' | 'Water' | 'Grass' | 'Electric';
  level: number;
  trainerId?: string;
}

export interface CreateUpdateTrainerDto {
  name: string;
  isChampion: boolean;
}
