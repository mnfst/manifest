import { EntityManifest } from './EntityManifest'

// Fields that are common to single and collection entity manifests.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EntityManifestCommonFields
  extends Pick<
    EntityManifest,
    | 'className'
    | 'nameSingular'
    | 'slug'
    | 'single'
    | 'properties'
    | 'hooks'
    | 'middlewares'
    | 'nested'
  > {}
