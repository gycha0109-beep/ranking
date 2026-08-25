import { materializeFamily, type ContentCorpus200Manifest, type ContentFamilySeed } from './schema'
import { CONTENT_CORPUS_200_FAMILIES_01 } from './families-01-games-media'
import { CONTENT_CORPUS_200_FAMILIES_02 } from './families-02-music-tech-sports'
import { CONTENT_CORPUS_200_FAMILIES_03 } from './families-03-mobility-travel-food'
import { CONTENT_CORPUS_200_FAMILIES_04 } from './families-04-beauty-subscriptions-consumer'

export const CONTENT_CORPUS_200_FAMILIES: ContentFamilySeed[] = [
  ...CONTENT_CORPUS_200_FAMILIES_01,
  ...CONTENT_CORPUS_200_FAMILIES_02,
  ...CONTENT_CORPUS_200_FAMILIES_03,
  ...CONTENT_CORPUS_200_FAMILIES_04,
]

export function buildContentCorpus200Manifest(): ContentCorpus200Manifest {
  return {
    manifestVersion: 'content-corpus-200-manifest-v1',
    status: 'CURATED_DRAFT_MANIFEST_PRE_MATERIALIZATION',
    authorityBoundary: {
      productionDatabaseWritesAuthorized: false,
      publicPublicationAuthorized: false,
      recommendationEvaluationAuthorized: false,
      taxonomyMutationAuthorized: false,
    },
    contentMix: {
      FACT: 60,
      EDITORIAL_COMPOSITE: 90,
      COMMUNITY_VOTE: 50,
    },
    rankings: CONTENT_CORPUS_200_FAMILIES.flatMap(materializeFamily),
  }
}

export const CONTENT_CORPUS_200_MANIFEST_V1 = buildContentCorpus200Manifest()
