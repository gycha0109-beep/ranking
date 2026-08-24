export type Rf1EvaluationCorpusKind = 'coverage' | 'blind' | 'adversarial'

export type Rf1EvaluationSemanticProjection = {
  ranking_id: string
  subject_key: string
  classification_state: 'reviewed'
  confidence: 1
  claim_signature: string
  view_signature: string
  version_signature: string
}

export type Rf1EvaluationRanking = {
  id: string
  corpusKind: Rf1EvaluationCorpusKind
  scenarioId: string
  testTag: string | null
  categoryId: string
  subcategoryId: string | null
  title: string
  rankingType: 'metric'
  itemIds: string[]
  publishedAt: string
  uniqueViewCount: number
  likeCount: number
  bookmarkCount: number
  recentExposureCount: 0
  semanticProjection: Rf1EvaluationSemanticProjection | null
}

export type Rf1EvaluationCorpus = {
  corpusId: 'rf1-evaluation-corpus-v1'
  generatorSeed: 'rf1-evaluation-corpus-v1:2026-08-24'
  referenceTime: '2026-08-24T09:15:00.000Z'
  coverage: Rf1EvaluationRanking[]
  blind: Rf1EvaluationRanking[]
  adversarial: Rf1EvaluationRanking[]
  all: Rf1EvaluationRanking[]
}

export const RF1L_CORPUS_ID = 'rf1-evaluation-corpus-v1' as const
export const RF1L_GENERATOR_SEED = 'rf1-evaluation-corpus-v1:2026-08-24' as const
export const RF1L_REFERENCE_TIME = '2026-08-24T09:15:00.000Z' as const

const DAY = 86_400_000
const referenceMs = Date.parse(RF1L_REFERENCE_TIME)

function hash32(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function createRandom(seed: string) {
  let state = hash32(seed) || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

function slug(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

function stableSample(values: string[], count: number, seed: string) {
  const random = createRandom(seed)
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy.slice(0, Math.min(count, copy.length))
}

function publishedAt(seed: string, minimumDays = 2, maximumDays = 180) {
  const random = createRandom(`${seed}:published`)
  const days = minimumDays + Math.floor(random() * (maximumDays - minimumDays + 1))
  const hours = Math.floor(random() * 24)
  return new Date(referenceMs - days * DAY - hours * 3_600_000).toISOString()
}

function engagement(seed: string) {
  const random = createRandom(`${seed}:engagement`)
  return {
    uniqueViewCount: Math.floor(Math.pow(random(), 3) * 1_200),
    likeCount: Math.floor(Math.pow(random(), 4) * 80),
    bookmarkCount: Math.floor(Math.pow(random(), 4) * 50),
  }
}

function projection(input: {
  rankingId: string
  subject: string
  claim?: string
  view?: string
  version?: string
}): Rf1EvaluationSemanticProjection {
  return {
    ranking_id: input.rankingId,
    subject_key: input.subject,
    classification_state: 'reviewed',
    confidence: 1,
    claim_signature: input.claim || `${input.subject}:claim:${input.rankingId}`,
    view_signature: input.view || `${input.subject}:view:${input.rankingId}`,
    version_signature: input.version || `${input.subject}:version:${input.rankingId}`,
  }
}

function ranking(input: {
  id: string
  corpusKind: Rf1EvaluationCorpusKind
  scenarioId: string
  testTag?: string | null
  categoryId: string
  subcategoryId?: string | null
  title: string
  itemIds: string[]
  publishedAt?: string
  uniqueViewCount?: number
  likeCount?: number
  bookmarkCount?: number
  semanticProjection?: Rf1EvaluationSemanticProjection | null
}): Rf1EvaluationRanking {
  const observed = engagement(input.id)
  return {
    id: input.id,
    corpusKind: input.corpusKind,
    scenarioId: input.scenarioId,
    testTag: input.testTag ?? null,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId ?? null,
    title: input.title,
    rankingType: 'metric',
    itemIds: [...new Set(input.itemIds)],
    publishedAt: input.publishedAt || publishedAt(input.id),
    uniqueViewCount: input.uniqueViewCount ?? observed.uniqueViewCount,
    likeCount: input.likeCount ?? observed.likeCount,
    bookmarkCount: input.bookmarkCount ?? observed.bookmarkCount,
    recentExposureCount: 0,
    semanticProjection: input.semanticProjection ?? null,
  }
}

type BlindWorld = {
  key: string
  category: string
  label: string
  participants: string[]
  metrics: string[]
}

const BLIND_WORLDS: BlindWorld[] = [
  {
    key: 'kbo-clubs', category: 'sports', label: 'KBO 구단',
    participants: ['LG 트윈스', '한화 이글스', 'SSG 랜더스', '삼성 라이온즈', '롯데 자이언츠', 'KT 위즈', 'NC 다이노스', 'KIA 타이거즈', '두산 베어스', '키움 히어로즈', '상무 피닉스', '퓨처스 연합'],
    metrics: ['종합 성과', '종합 성과', '팀 타율', '평균자책점', '홈런', '득점', '관중 수', '선수단 연봉'],
  },
  {
    key: 'pisa-countries', category: 'education', label: 'PISA 참가국',
    participants: ['싱가포르', '일본', '대한민국', '에스토니아', '캐나다', '아일랜드', '스위스', '호주', '핀란드', '뉴질랜드', '영국', '덴마크'],
    metrics: ['종합 학업 성취', '종합 학업 성취', '수학 점수', '읽기 점수', '과학 점수', '성취도 격차', '상위권 비율', '기초 미달 비율'],
  },
  {
    key: 'smartphones', category: 'technology', label: '스마트폰 모델',
    participants: ['Galaxy S Ultra', 'iPhone Pro Max', 'Pixel Pro', 'Xperia Flagship', 'Xiaomi Ultra', 'OnePlus Pro', 'Honor Magic', 'Oppo Find', 'Vivo X Pro', 'Motorola Edge', 'Nothing Phone', 'Asus Zenfone'],
    metrics: ['종합 성능', '종합 성능', '배터리 지속시간', '카메라 화질', '충전 속도', '디스플레이 밝기', '발열 억제', '무게 대비 성능'],
  },
  {
    key: 'laptops', category: 'technology', label: '노트북 모델',
    participants: ['MacBook Pro', 'Dell XPS', 'ThinkPad X1', 'Galaxy Book', 'LG gram', 'Surface Laptop', 'Asus Zenbook', 'HP Spectre', 'Acer Swift', 'Razer Blade', 'Framework Laptop', 'MSI Prestige'],
    metrics: ['종합 사용성', '종합 사용성', '배터리 지속시간', 'CPU 성능', 'GPU 성능', '디스플레이 품질', '휴대성', '키보드 품질'],
  },
  {
    key: 'electric-cars', category: 'mobility', label: '전기차 모델',
    participants: ['Ioniq 5', 'EV6', 'Model Y', 'Model 3', 'Mustang Mach-E', 'ID.4', 'Polestar 2', 'BMW i4', 'Mercedes EQE', 'Audi Q4 e-tron', 'Volvo EX40', 'Nissan Ariya'],
    metrics: ['종합 상품성', '종합 상품성', '주행거리', '충전 속도', '전비', '실내 공간', '트렁크 용량', '가격 대비 성능'],
  },
  {
    key: 'airports', category: 'travel', label: '국제공항',
    participants: ['인천국제공항', '창이공항', '하네다공항', '도하 하마드공항', '두바이국제공항', '런던 히드로', '파리 샤를드골', '암스테르담 스키폴', '프랑크푸르트공항', '로스앤젤레스공항', '시드니공항', '홍콩국제공항'],
    metrics: ['종합 운영 지표', '종합 운영 지표', '연간 이용객', '정시 운항률', '환승 편의성', '취항 도시 수', '터미널 규모', '수하물 처리량'],
  },
  {
    key: 'global-cities', category: 'geography', label: '세계 도시',
    participants: ['도쿄', '서울', '뉴욕', '런던', '파리', '싱가포르', '시드니', '토론토', '베를린', '마드리드', '두바이', '암스테르담'],
    metrics: ['종합 도시 지표', '종합 도시 지표', '인구', '대중교통 이용률', '주거비', '녹지 면적', '관광객 수', '창업 생태계 규모'],
  },
  {
    key: 'economies', category: 'economy', label: '국가 경제',
    participants: ['미국', '중국', '독일', '일본', '인도', '영국', '프랑스', '이탈리아', '브라질', '캐나다', '대한민국', '호주'],
    metrics: ['종합 경제 규모', '종합 경제 규모', '명목 GDP', '1인당 GDP', '수출액', '외환보유액', '제조업 부가가치', '서비스업 부가가치'],
  },
  {
    key: 'streaming-services', category: 'media', label: '스트리밍 서비스',
    participants: ['Netflix', 'Disney+', 'Prime Video', 'Apple TV+', 'Max', 'Paramount+', 'Hulu', 'Peacock', 'Tving', 'Wavve', 'Watcha', 'Coupang Play'],
    metrics: ['종합 서비스 지표', '종합 서비스 지표', '콘텐츠 수', '월 구독료', '화질', '동시 접속 수', '오리지널 작품 수', '지원 기기 수'],
  },
  {
    key: 'hotels', category: 'travel', label: '도심 호텔',
    participants: ['Grand Central', 'Riverside Hotel', 'City Garden', 'Harbor View', 'Metro Palace', 'Skyline Hotel', 'Park Avenue', 'Royal Square', 'Urban Stay', 'Central Boutique', 'Lake House', 'Station Hotel'],
    metrics: ['종합 숙박 지표', '종합 숙박 지표', '객실 면적', '조식 만족도', '교통 접근성', '평균 숙박비', '체크인 속도', '부대시설 수'],
  },
  {
    key: 'universities', category: 'education', label: '종합대학',
    participants: ['Seoul National', 'KAIST', 'Yonsei', 'Korea University', 'POSTECH', 'MIT', 'Stanford', 'Oxford', 'Cambridge', 'ETH Zurich', 'NUS', 'University of Tokyo'],
    metrics: ['종합 교육 지표', '종합 교육 지표', '연구 인용', '학생 대 교원 비율', '국제학생 비율', '졸업생 취업률', '연구비', '산학협력 규모'],
  },
  {
    key: 'hospitals', category: 'health', label: '종합병원',
    participants: ['Seoul Medical Center', 'Samsung Medical', 'Asan Medical', 'Severance', 'Mayo Clinic', 'Cleveland Clinic', 'Johns Hopkins', 'Mass General', 'Charite', 'Toronto General', 'Singapore General', 'Royal Melbourne'],
    metrics: ['종합 의료 지표', '종합 의료 지표', '병상 수', '전문의 수', '응급 대기시간', '간호 인력', '연구 논문 수', '환자 만족도'],
  },
  {
    key: 'running-shoes', category: 'sports', label: '러닝화 모델',
    participants: ['Nike Pegasus', 'Adidas Boston', 'Asics Nimbus', 'New Balance 1080', 'Saucony Triumph', 'Hoka Clifton', 'Brooks Ghost', 'Mizuno Wave Rider', 'On Cloudmonster', 'Puma Velocity', 'Reebok Floatride', 'Under Armour Infinite'],
    metrics: ['종합 주행 평가', '종합 주행 평가', '쿠셔닝', '무게', '에너지 리턴', '젖은 노면 접지', '내구성', '안정성'],
  },
  {
    key: 'cameras', category: 'technology', label: '미러리스 카메라',
    participants: ['Sony Alpha A', 'Canon EOS R', 'Nikon Z', 'Fujifilm X', 'Panasonic Lumix S', 'OM System OM', 'Leica SL', 'Sigma fp', 'Hasselblad X', 'Sony Alpha C', 'Canon EOS RP', 'Nikon Zf'],
    metrics: ['종합 촬영 성능', '종합 촬영 성능', '다이내믹 레인지', '자동초점 속도', '연사 속도', '배터리 촬영 매수', '바디 무게', '동영상 해상력'],
  },
]

function buildBlindCorpus() {
  const rows: Rf1EvaluationRanking[] = []

  for (const world of BLIND_WORLDS) {
    const participantIds = world.participants.map((name) => `${world.key}:item:${slug(name)}`)
    world.metrics.forEach((metric, index) => {
      const sequence = index + 1
      const id = `rf1l-blind-${world.key}-${String(sequence).padStart(2, '0')}`
      const year = index === 0 ? 2025 : 2026
      const subject = index < 2
        ? `${world.key}:overall`
        : `${world.key}:${slug(metric)}`
      const sharedClaim = index < 2 ? `${world.key}:overall:claim` : undefined
      const sharedView = index < 2 ? `${world.key}:overall:view` : undefined
      const semanticProjection = projection({
        rankingId: id,
        subject,
        claim: sharedClaim,
        view: sharedView,
        version: `${subject}:version:${year}:${sequence}`,
      })

      rows.push(ranking({
        id,
        corpusKind: 'blind',
        scenarioId: world.key,
        categoryId: `cat-${world.category}`,
        subcategoryId: `sub-${world.key}`,
        title: `${year} ${world.label} ${metric} TOP 7`,
        itemIds: stableSample(participantIds, 7, `${RF1L_GENERATOR_SEED}:${world.key}:${sequence}`),
        semanticProjection,
      }))
    })
  }

  return rows
}

function coverageItems(scenario: string) {
  return Array.from({ length: 12 }, (_, index) => `coverage:${scenario}:item-${String(index + 1).padStart(2, '0')}`)
}

function buildIdentityCoverage() {
  const scenario = 'identity-prefix'
  const items = coverageItems(scenario)
  const subject = 'coverage:identity:shared-subject'
  return Array.from({ length: 8 }, (_, index) => {
    const sequence = index + 1
    const id = `rf1l-coverage-${scenario}-${sequence}`
    const identity = index < 5
      ? projection({
          rankingId: id,
          subject,
          claim: index < 4 ? 'coverage:identity:claim-1' : 'coverage:identity:claim-2',
          view: index < 3 ? 'coverage:identity:view-1' : `coverage:identity:view-${sequence}`,
          version: index < 2 ? 'coverage:identity:version-1' : `coverage:identity:version-${sequence}`,
        })
      : projection({ rankingId: id, subject: `coverage:identity:other-${sequence}` })
    return ranking({
      id,
      corpusKind: 'coverage',
      scenarioId: scenario,
      testTag: 'IA2_PREFIX_MUST_NOT_MOVE',
      categoryId: 'cat-coverage-sports',
      subcategoryId: 'sub-coverage-identity',
      title: `2026 프로리그 시즌 성과 지표 ${sequence} TOP 7`,
      itemIds: items.slice(index % 4, index % 4 + 7),
      semanticProjection: identity,
    })
  })
}

function buildOverlapCoverage() {
  const scenario = 'overlap-gradient'
  const items = coverageItems(scenario)
  const sets = [
    [0, 1, 2, 3, 4, 5, 6],
    [0, 1, 2, 3, 4, 5, 7],
    [0, 1, 2, 3, 4, 8, 9],
    [0, 1, 2, 3, 7, 8, 9],
    [0, 1, 2, 7, 8, 9, 10],
    [0, 1, 7, 8, 9, 10, 11],
    [0, 6, 7, 8, 9, 10, 11],
    [5, 6, 7, 8, 9, 10, 11],
  ]
  return sets.map((indexes, index) => ranking({
    id: `rf1l-coverage-${scenario}-${index + 1}`,
    corpusKind: 'coverage',
    scenarioId: scenario,
    testTag: 'CONTEXTUAL_RELEVANCE_GRADIENT',
    categoryId: 'cat-coverage-tech',
    subcategoryId: 'sub-coverage-overlap',
    title: index < 4
      ? `2026 스마트 기기 배터리 성능 지표 ${index + 1} TOP 7`
      : `2026 스마트 기기 실사용 평가 ${index + 1} TOP 7`,
    itemIds: indexes.map((itemIndex) => items[itemIndex]),
    semanticProjection: projection({ rankingId: `rf1l-coverage-${scenario}-${index + 1}`, subject: `coverage:overlap:${index + 1}` }),
  }))
}

function buildPopularityCoverage() {
  const scenario = 'popularity-pressure'
  const items = coverageItems(scenario)
  return Array.from({ length: 8 }, (_, index) => ranking({
    id: `rf1l-coverage-${scenario}-${index + 1}`,
    corpusKind: 'coverage',
    scenarioId: scenario,
    testTag: 'POPULARITY_MUST_NOT_BECOME_RELEVANCE_AUTHORITY',
    categoryId: 'cat-coverage-media',
    subcategoryId: 'sub-coverage-popularity',
    title: index === 7 ? '2026 스트리밍 서비스 화제성 TOP 7' : `2026 스트리밍 서비스 품질 지표 ${index + 1} TOP 7`,
    itemIds: index === 7 ? items.slice(5, 12) : items.slice(index % 3, index % 3 + 7),
    uniqueViewCount: index === 7 ? 1_000_000 : index * 3,
    likeCount: index === 7 ? 100_000 : index,
    bookmarkCount: index === 7 ? 50_000 : Math.floor(index / 2),
    semanticProjection: projection({ rankingId: `rf1l-coverage-${scenario}-${index + 1}`, subject: `coverage:popularity:${index + 1}` }),
  }))
}

function buildFreshnessCoverage() {
  const scenario = 'freshness-pressure'
  const items = coverageItems(scenario)
  return Array.from({ length: 8 }, (_, index) => ranking({
    id: `rf1l-coverage-${scenario}-${index + 1}`,
    corpusKind: 'coverage',
    scenarioId: scenario,
    testTag: 'FRESHNESS_MUST_REMAIN_SECONDARY',
    categoryId: 'cat-coverage-economy',
    subcategoryId: 'sub-coverage-freshness',
    title: `국가 경제 생산성 지표 ${index + 1} TOP 7`,
    itemIds: index < 4 ? items.slice(0, 7) : items.slice(index - 3, index + 4),
    publishedAt: new Date(referenceMs - (index === 7 ? 1 : 365 - index * 40) * DAY).toISOString(),
    semanticProjection: projection({ rankingId: `rf1l-coverage-${scenario}-${index + 1}`, subject: `coverage:freshness:${index + 1}` }),
  }))
}

function buildProfileCoverage() {
  const scenario = 'profile-affinity'
  const items = coverageItems(scenario)
  const affinity = 'coverage:profile-affinity:anchor-item'
  return Array.from({ length: 8 }, (_, index) => ranking({
    id: `rf1l-coverage-${scenario}-${index + 1}`,
    corpusKind: 'coverage',
    scenarioId: scenario,
    testTag: index === 7 ? 'AFFINITY_TARGET' : 'PROFILE_AFFINITY_CONTROL',
    categoryId: 'cat-coverage-consumer',
    subcategoryId: 'sub-coverage-profile',
    title: `2026 소비자 제품 만족도 지표 ${index + 1} TOP 7`,
    itemIds: index === 7
      ? [affinity, ...items.slice(5, 11)]
      : items.slice(index % 4, index % 4 + 7),
    semanticProjection: projection({ rankingId: `rf1l-coverage-${scenario}-${index + 1}`, subject: `coverage:profile:${index + 1}` }),
  }))
}

function buildDiversityCoverage() {
  const scenario = 'diversity-pressure'
  const sharedItems = coverageItems(scenario)
  return Array.from({ length: 8 }, (_, index) => ranking({
    id: `rf1l-coverage-${scenario}-${index + 1}`,
    corpusKind: 'coverage',
    scenarioId: scenario,
    testTag: 'DIVERSITY_MUST_BE_BOUNDED',
    categoryId: 'cat-coverage-travel',
    subcategoryId: index < 4 ? 'sub-coverage-diversity-a' : `sub-coverage-diversity-${index}`,
    title: index < 4
      ? `2026 여행지 접근성 지표 ${index + 1} TOP 7`
      : `2026 여행 서비스 이용 지표 ${index + 1} TOP 7`,
    itemIds: sharedItems.slice(index % 5, index % 5 + 7),
    semanticProjection: projection({ rankingId: `rf1l-coverage-${scenario}-${index + 1}`, subject: `coverage:diversity:${index + 1}` }),
  }))
}

function buildTieCoverage() {
  const scenario = 'deterministic-ties'
  const items = coverageItems(scenario).slice(0, 7)
  const time = new Date(referenceMs - 20 * DAY).toISOString()
  return Array.from({ length: 8 }, (_, index) => ranking({
    id: `rf1l-coverage-${scenario}-${index + 1}`,
    corpusKind: 'coverage',
    scenarioId: scenario,
    testTag: 'DETERMINISTIC_TIEBREAK',
    categoryId: 'cat-coverage-tie',
    subcategoryId: 'sub-coverage-tie',
    title: '2026 동일 조건 반복 평가 TOP 7',
    itemIds: items,
    publishedAt: time,
    uniqueViewCount: 10,
    likeCount: 2,
    bookmarkCount: 1,
    semanticProjection: projection({ rankingId: `rf1l-coverage-${scenario}-${index + 1}`, subject: `coverage:tie:${index + 1}` }),
  }))
}

function buildCoverageCorpus() {
  return [
    ...buildIdentityCoverage(),
    ...buildOverlapCoverage(),
    ...buildPopularityCoverage(),
    ...buildFreshnessCoverage(),
    ...buildProfileCoverage(),
    ...buildDiversityCoverage(),
    ...buildTieCoverage(),
  ]
}

function adversarialItems(scenario: string) {
  return Array.from({ length: 14 }, (_, index) => `adversarial:${scenario}:item-${String(index + 1).padStart(2, '0')}`)
}

function buildPopularityAdversarial() {
  const scenario = 'extreme-popularity'
  const items = adversarialItems(scenario)
  return Array.from({ length: 8 }, (_, index) => ranking({
    id: `rf1l-adversarial-${scenario}-${index + 1}`,
    corpusKind: 'adversarial',
    scenarioId: scenario,
    testTag: index === 7 ? 'EXTREME_POPULARITY_OUTLIER' : 'EXTREME_POPULARITY_CONTROL',
    categoryId: 'cat-adversarial-media',
    subcategoryId: 'sub-adversarial-popularity',
    title: index === 7 ? '바이럴 화제 콘텐츠 조회수 TOP 7' : `콘텐츠 품질 유사도 평가 ${index + 1} TOP 7`,
    itemIds: index === 7 ? items.slice(7, 14) : items.slice(index % 3, index % 3 + 7),
    uniqueViewCount: index === 7 ? 2_000_000_000 : index,
    likeCount: index === 7 ? 100_000_000 : 0,
    bookmarkCount: index === 7 ? 50_000_000 : 0,
    semanticProjection: projection({ rankingId: `rf1l-adversarial-${scenario}-${index + 1}`, subject: `adversarial:popularity:${index + 1}` }),
  }))
}

function buildFreshnessAdversarial() {
  const scenario = 'extreme-freshness'
  const items = adversarialItems(scenario)
  return Array.from({ length: 8 }, (_, index) => ranking({
    id: `rf1l-adversarial-${scenario}-${index + 1}`,
    corpusKind: 'adversarial',
    scenarioId: scenario,
    testTag: index === 7 ? 'ULTRA_FRESH_WEAK_CANDIDATE' : 'OLD_RELEVANT_CONTROL',
    categoryId: 'cat-adversarial-tech',
    subcategoryId: 'sub-adversarial-freshness',
    title: index === 7 ? '오늘 공개 신제품 화제성 TOP 7' : `장기 성능 검증 제품 지표 ${index + 1} TOP 7`,
    itemIds: index === 7 ? items.slice(7, 14) : items.slice(0, 7),
    publishedAt: new Date(referenceMs - (index === 7 ? 60_000 : (720 + index * 30) * DAY)).toISOString(),
    semanticProjection: projection({ rankingId: `rf1l-adversarial-${scenario}-${index + 1}`, subject: `adversarial:freshness:${index + 1}` }),
  }))
}

function buildIdentitySaturationAdversarial() {
  const scenario = 'identity-saturation'
  const items = adversarialItems(scenario)
  const subject = 'adversarial:identity:single-subject'
  return Array.from({ length: 8 }, (_, index) => {
    const id = `rf1l-adversarial-${scenario}-${index + 1}`
    return ranking({
      id,
      corpusKind: 'adversarial',
      scenarioId: scenario,
      testTag: 'ALL_RELATED_MUST_BE_IA2_PROTECTED',
      categoryId: 'cat-adversarial-sports',
      subcategoryId: 'sub-adversarial-identity',
      title: `동일 주제 시즌 버전 ${index + 1} TOP 7`,
      itemIds: items.slice(index % 4, index % 4 + 7),
      semanticProjection: projection({
        rankingId: id,
        subject,
        claim: 'adversarial:identity:claim',
        view: `adversarial:identity:view:${Math.floor(index / 2)}`,
        version: `adversarial:identity:version:${index + 1}`,
      }),
    })
  })
}

function buildDuplicateTieAdversarial() {
  const scenario = 'duplicate-tie'
  const items = adversarialItems(scenario).slice(0, 7)
  const time = new Date(referenceMs - 45 * DAY).toISOString()
  return Array.from({ length: 8 }, (_, index) => ranking({
    id: `rf1l-adversarial-${scenario}-${index + 1}`,
    corpusKind: 'adversarial',
    scenarioId: scenario,
    testTag: 'EXACT_SCORE_TIE_MUST_BE_DETERMINISTIC',
    categoryId: 'cat-adversarial-tie',
    subcategoryId: 'sub-adversarial-tie',
    title: '완전 동일 입력 조건 비교 TOP 7',
    itemIds: items,
    publishedAt: time,
    uniqueViewCount: 0,
    likeCount: 0,
    bookmarkCount: 0,
    semanticProjection: projection({ rankingId: `rf1l-adversarial-${scenario}-${index + 1}`, subject: `adversarial:tie:${index + 1}` }),
  }))
}

function buildAdversarialCorpus() {
  return [
    ...buildPopularityAdversarial(),
    ...buildFreshnessAdversarial(),
    ...buildIdentitySaturationAdversarial(),
    ...buildDuplicateTieAdversarial(),
  ]
}

export function buildRf1EvaluationCorpus(): Rf1EvaluationCorpus {
  const coverage = buildCoverageCorpus()
  const blind = buildBlindCorpus()
  const adversarial = buildAdversarialCorpus()
  return {
    corpusId: RF1L_CORPUS_ID,
    generatorSeed: RF1L_GENERATOR_SEED,
    referenceTime: RF1L_REFERENCE_TIME,
    coverage,
    blind,
    adversarial,
    all: [...coverage, ...blind, ...adversarial],
  }
}

export const RF1_EVALUATION_CORPUS_V1 = buildRf1EvaluationCorpus()
