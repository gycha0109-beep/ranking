export type Rf1mHoldoutSemanticProjection = {
  ranking_id: string
  subject_key: string
  classification_state: 'reviewed'
  confidence: 1
  claim_signature: string
  view_signature: string
  version_signature: string
}

export type Rf1mHoldoutRanking = {
  id: string
  worldKey: string
  categoryId: string
  subcategoryId: string | null
  title: string
  rankingType: 'metric' | 'user_vote'
  itemIds: string[]
  publishedAt: string
  uniqueViewCount: number
  likeCount: number
  bookmarkCount: number
  recentExposureCount: number
  semanticProjection: Rf1mHoldoutSemanticProjection
}

export type Rf1mMixedHoldoutCorpus = {
  corpusId: 'rf1m-independent-mixed-holdout-v1'
  generatorSeed: 'rf1m-independent-mixed-holdout-v1:2026-08-24'
  referenceTime: '2026-08-24T09:50:00.000Z'
  generationBoundary: 'CONTENT_WORLD_ONLY_NO_RECOMMENDATION_POLICY_ACCESS'
  worldCount: number
  rankings: Rf1mHoldoutRanking[]
}

export const RF1M_CORPUS_ID = 'rf1m-independent-mixed-holdout-v1' as const
export const RF1M_GENERATOR_SEED = 'rf1m-independent-mixed-holdout-v1:2026-08-24' as const
export const RF1M_REFERENCE_TIME = '2026-08-24T09:50:00.000Z' as const
export const RF1M_GENERATION_BOUNDARY = 'CONTENT_WORLD_ONLY_NO_RECOMMENDATION_POLICY_ACCESS' as const

const DAY = 86_400_000
const referenceMs = Date.parse(RF1M_REFERENCE_TIME)

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

function shuffled<T>(values: T[], seed: string) {
  const random = createRandom(seed)
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function choose<T>(values: T[], seed: string) {
  const random = createRandom(seed)
  return values[Math.floor(random() * values.length)]
}

function sample<T>(values: T[], count: number, seed: string) {
  return shuffled(values, seed).slice(0, Math.min(count, values.length))
}

function irregularPublishedAt(seed: string) {
  const random = createRandom(`${seed}:published-at`)
  const regime = random()
  let days: number

  if (regime < 0.48) {
    days = 1 + Math.floor(random() * 75)
  } else if (regime < 0.82) {
    days = 76 + Math.floor(random() * 290)
  } else {
    days = 366 + Math.floor(random() * 1_100)
  }

  const hours = Math.floor(random() * 24)
  const minutes = Math.floor(random() * 60)
  return new Date(referenceMs - days * DAY - hours * 3_600_000 - minutes * 60_000).toISOString()
}

function longTailEngagement(seed: string) {
  const random = createRandom(`${seed}:engagement`)
  const visibilityRoll = random()
  const uniqueViewCount = visibilityRoll < 0.42
    ? 0
    : Math.floor(Math.pow(random(), 5) * 38_000)
  const likeRate = 0.004 + random() * 0.075
  const bookmarkRate = 0.002 + random() * 0.048

  return {
    uniqueViewCount,
    likeCount: Math.min(uniqueViewCount, Math.floor(uniqueViewCount * likeRate * random())),
    bookmarkCount: Math.min(uniqueViewCount, Math.floor(uniqueViewCount * bookmarkRate * random())),
    recentExposureCount: Math.floor(Math.pow(random(), 2.4) * 9),
  }
}

type HoldoutWorld = {
  key: string
  category: string
  label: string
  subcategories: string[]
  entities: string[]
  metrics: string[]
  editions: string[]
}

const WORLDS: HoldoutWorld[] = [
  {
    key: 'kbo-clubs',
    category: 'sports',
    label: 'KBO 구단',
    subcategories: ['team-performance', 'offense', 'pitching', 'business'],
    entities: ['LG 트윈스', '한화 이글스', 'SSG 랜더스', '삼성 라이온즈', '롯데 자이언츠', 'KT 위즈', 'NC 다이노스', 'KIA 타이거즈', '두산 베어스', '키움 히어로즈'],
    metrics: ['승률', '팀 타율', '출루율', '장타율', '평균자책점', '불펜 평균자책점', '홈런', '득점', '실점', '평균 관중', '선수단 연봉'],
    editions: ['2023', '2024', '2025', '2026'],
  },
  {
    key: 'football-clubs',
    category: 'sports',
    label: '유럽 축구 클럽',
    subcategories: ['club-performance', 'attack', 'defense', 'finance'],
    entities: ['Manchester City', 'Liverpool', 'Arsenal', 'Chelsea', 'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Bayern Munich', 'Dortmund', 'Inter', 'Milan', 'Juventus', 'PSG', 'Marseille', 'Ajax', 'Benfica'],
    metrics: ['리그 승점', '득점', '실점 억제', '슈팅 효율', '점유율', '선수단 가치', '임금 효율', '평균 관중', '원정 성적'],
    editions: ['2022-23', '2023-24', '2024-25', '2025-26'],
  },
  {
    key: 'national-economies',
    category: 'economy',
    label: '국가 경제',
    subcategories: ['scale', 'income', 'trade', 'industry'],
    entities: ['미국', '중국', '독일', '일본', '인도', '영국', '프랑스', '이탈리아', '브라질', '캐나다', '대한민국', '호주', '스페인', '멕시코', '인도네시아', '네덜란드', '사우디아라비아', '튀르키예', '스위스', '폴란드'],
    metrics: ['명목 GDP', '1인당 GDP', '수출액', '수입액', '제조업 부가가치', '서비스업 부가가치', '외환보유액', '생산성', '경제 성장률'],
    editions: ['2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'global-cities',
    category: 'geography',
    label: '세계 도시',
    subcategories: ['population', 'mobility', 'cost', 'environment', 'tourism'],
    entities: ['서울', '도쿄', '오사카', '싱가포르', '홍콩', '방콕', '자카르타', '시드니', '멜버른', '뉴욕', '로스앤젤레스', '샌프란시스코', '토론토', '밴쿠버', '런던', '파리', '베를린', '마드리드', '암스테르담', '로마', '두바이', '이스탄불', '멕시코시티', '상파울루'],
    metrics: ['도시 인구', '대중교통 이용률', '통근 시간', '주거비 부담', '생활비', '녹지 면적', '관광객 수', '호텔 객실 수', '창업 투자 규모', '보행 친화도'],
    editions: ['2021', '2022', '2023', '2024', '2025'],
  },
  {
    key: 'smartphones',
    category: 'technology',
    label: '플래그십 스마트폰',
    subcategories: ['performance', 'camera', 'battery', 'display', 'ergonomics'],
    entities: ['Galaxy S Ultra', 'iPhone Pro Max', 'Pixel Pro', 'Xperia Flagship', 'Xiaomi Ultra', 'OnePlus Pro', 'Honor Magic Pro', 'Oppo Find Pro', 'Vivo X Pro', 'Motorola Edge Ultra', 'Nothing Phone Pro', 'Asus Zenfone Pro', 'Huawei Mate Pro', 'Realme GT Pro', 'RedMagic Pro'],
    metrics: ['CPU 성능', 'GPU 성능', '배터리 지속시간', '충전 속도', '저조도 카메라', '망원 카메라', '동영상 안정화', '디스플레이 밝기', '색 정확도', '발열 억제', '무게 대비 성능'],
    editions: ['2023', '2024', '2025', '2026'],
  },
  {
    key: 'laptops',
    category: 'technology',
    label: '프리미엄 노트북',
    subcategories: ['performance', 'battery', 'display', 'portability', 'input'],
    entities: ['MacBook Pro', 'Dell XPS', 'ThinkPad X1', 'Galaxy Book Pro', 'LG gram Pro', 'Surface Laptop', 'Asus Zenbook', 'HP Spectre', 'Acer Swift', 'Razer Blade', 'Framework Laptop', 'MSI Prestige', 'Lenovo Yoga', 'Huawei MateBook', 'Gigabyte Aero'],
    metrics: ['CPU 성능', 'GPU 성능', '배터리 지속시간', '충전 시간', '디스플레이 색 정확도', '최대 밝기', '휴대성', '키보드 품질', '트랙패드 품질', '팬 소음', '포트 구성'],
    editions: ['2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'mirrorless-cameras',
    category: 'technology',
    label: '미러리스 카메라',
    subcategories: ['sensor', 'autofocus', 'video', 'handling'],
    entities: ['Sony Alpha A', 'Canon EOS R', 'Nikon Z', 'Fujifilm X', 'Panasonic Lumix S', 'OM System OM', 'Leica SL', 'Sigma fp', 'Hasselblad X', 'Sony Alpha C', 'Canon EOS RP', 'Nikon Zf'],
    metrics: ['다이내믹 레인지', '고감도 노이즈', '자동초점 속도', '피사체 추적', '연사 속도', '동영상 해상력', '손떨림 보정', '배터리 촬영 매수', '바디 무게'],
    editions: ['2021', '2022', '2023', '2024', '2025'],
  },
  {
    key: 'electric-cars',
    category: 'mobility',
    label: '전기차',
    subcategories: ['range', 'charging', 'efficiency', 'space', 'value'],
    entities: ['Ioniq 5', 'EV6', 'Model Y', 'Model 3', 'Mustang Mach-E', 'ID.4', 'Polestar 2', 'BMW i4', 'Mercedes EQE', 'Audi Q4 e-tron', 'Volvo EX40', 'Nissan Ariya', 'Kona Electric', 'BYD Seal', 'BYD Atto', 'Lucid Air', 'Rivian R1S'],
    metrics: ['실주행거리', '고속도로 주행거리', '급속 충전 속도', '전비', '실내 공간', '트렁크 용량', '회생제동 효율', '차량 가격', '가격 대비 주행거리'],
    editions: ['2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'airlines',
    category: 'travel',
    label: '항공사',
    subcategories: ['operations', 'network', 'cabin', 'fees'],
    entities: ['Korean Air', 'Asiana', 'Singapore Airlines', 'ANA', 'JAL', 'Cathay Pacific', 'Emirates', 'Qatar Airways', 'Etihad', 'Lufthansa', 'Air France', 'KLM', 'British Airways', 'Delta', 'United', 'American Airlines', 'Qantas', 'Turkish Airlines'],
    metrics: ['정시 운항률', '결항률', '취항 도시 수', '평균 좌석 간격', '수하물 허용량', '수하물 추가 요금', '기내 서비스 만족도', '환승 연결성'],
    editions: ['2022', '2023', '2024', '2025'],
  },
  {
    key: 'airports',
    category: 'travel',
    label: '국제공항',
    subcategories: ['traffic', 'operations', 'connectivity', 'facilities'],
    entities: ['인천국제공항', '창이공항', '하네다공항', '나리타공항', '도하 하마드공항', '두바이국제공항', '런던 히드로', '파리 샤를드골', '암스테르담 스키폴', '프랑크푸르트공항', '로스앤젤레스공항', '샌프란시스코공항', '시드니공항', '홍콩국제공항', '방콕 수완나품', '이스탄불공항', '토론토 피어슨', '뉴욕 JFK'],
    metrics: ['연간 이용객', '국제선 이용객', '정시 운항률', '환승 연결 시간', '취항 도시 수', '터미널 면적', '수하물 처리량', '철도 접근성', '라운지 수'],
    editions: ['2021', '2022', '2023', '2024', '2025'],
  },
  {
    key: 'universities',
    category: 'education',
    label: '종합대학',
    subcategories: ['research', 'teaching', 'international', 'outcomes'],
    entities: ['서울대학교', 'KAIST', '연세대학교', '고려대학교', 'POSTECH', 'MIT', 'Stanford', 'Harvard', 'Oxford', 'Cambridge', 'ETH Zurich', 'NUS', 'University of Tokyo', 'Tsinghua', 'Peking University', 'Melbourne', 'Toronto', 'UCL', 'Imperial College', 'EPFL'],
    metrics: ['연구 인용', '연구비', '학생 대 교원 비율', '국제학생 비율', '국제교원 비율', '졸업생 취업률', '산학협력 규모', '박사과정 비율', '논문 생산성'],
    editions: ['2021', '2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'hospitals',
    category: 'health',
    label: '종합병원',
    subcategories: ['capacity', 'staffing', 'access', 'research', 'experience'],
    entities: ['서울아산병원', '삼성서울병원', '세브란스병원', '서울대학교병원', '분당서울대학교병원', 'Mayo Clinic', 'Cleveland Clinic', 'Johns Hopkins', 'Mass General', 'Charite', 'Toronto General', 'Singapore General', 'Royal Melbourne', 'UCSF Medical', 'Mount Sinai'],
    metrics: ['병상 수', '전문의 수', '간호 인력', '응급 대기시간', '외래 대기시간', '연구 논문 수', '임상시험 수', '환자 만족도', '중환자실 규모'],
    editions: ['2022', '2023', '2024', '2025'],
  },
  {
    key: 'streaming-services',
    category: 'media',
    label: '스트리밍 서비스',
    subcategories: ['catalog', 'price', 'quality', 'features'],
    entities: ['Netflix', 'Disney+', 'Prime Video', 'Apple TV+', 'Max', 'Paramount+', 'Hulu', 'Peacock', 'Tving', 'Wavve', 'Watcha', 'Coupang Play', 'YouTube Premium', 'Crunchyroll'],
    metrics: ['콘텐츠 수', '오리지널 작품 수', '월 구독료', '4K 지원 작품 비율', '최대 동시 접속 수', '지원 기기 수', '다운로드 기능', '자막 언어 수', '광고 요금제 가격'],
    editions: ['2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'movies',
    category: 'media',
    label: '영화',
    subcategories: ['box-office', 'audience', 'critics', 'awards'],
    entities: ['영화 A', '영화 B', '영화 C', '영화 D', '영화 E', '영화 F', '영화 G', '영화 H', '영화 I', '영화 J', '영화 K', '영화 L', '영화 M', '영화 N', '영화 O', '영화 P', '영화 Q', '영화 R', '영화 S', '영화 T', '영화 U', '영화 V', '영화 W', '영화 X', '영화 Y', '영화 Z'],
    metrics: ['극장 매출', '관객 수', '관객 평점', '비평가 평점', '재관람 의향', '상영관 수', '개봉 첫 주 매출', '수상 횟수'],
    editions: ['2020', '2021', '2022', '2023', '2024', '2025'],
  },
  {
    key: 'video-games',
    category: 'media',
    label: '비디오 게임',
    subcategories: ['sales', 'reviews', 'players', 'technical'],
    entities: ['Game Atlas', 'Game Beacon', 'Game Citadel', 'Game Drift', 'Game Ember', 'Game Frontier', 'Game Grove', 'Game Harbor', 'Game Ion', 'Game Junction', 'Game Kingdom', 'Game Lantern', 'Game Mosaic', 'Game Nexus', 'Game Orbit', 'Game Pulse', 'Game Quartz', 'Game Rift', 'Game Summit', 'Game Tundra'],
    metrics: ['판매량', '동시 접속자', '사용자 평점', '전문가 평점', '평균 플레이시간', '프레임 안정성', '로딩 시간', '업데이트 빈도'],
    editions: ['2021', '2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'restaurants',
    category: 'local',
    label: '도심 레스토랑',
    subcategories: ['food', 'service', 'value', 'access'],
    entities: ['Maple Table', 'River Kitchen', 'Stone Plate', 'Garden Dining', 'Blue Door', 'Central Grill', 'Harbor Spoon', 'Market Room', 'North Table', 'Olive House', 'Sunset Kitchen', 'Brick Oven', 'Green Fork', 'Station Dining', 'Corner Bistro', 'Lake Plate', 'Oak Room', 'Urban Pantry', 'Field Table', 'Cedar Kitchen', 'Canvas Dining', 'Copper Spoon', 'Meadow Grill', 'Pier Table', 'Hill Bistro', 'Park Kitchen', 'Cloud Dining', 'Forest Plate', 'Square Table', 'Morning Fork'],
    metrics: ['음식 만족도', '서비스 속도', '가격 대비 만족도', '대기 시간', '예약 가능성', '소음 수준', '좌석 간격', '메뉴 다양성', '재방문 의향'],
    editions: ['봄', '여름', '가을', '겨울', '연간'],
  },
  {
    key: 'coffee-shops',
    category: 'local',
    label: '카페',
    subcategories: ['coffee', 'workspace', 'price', 'access'],
    entities: ['Bean Yard', 'Morning Roast', 'Paper Cup', 'Quiet Bean', 'Corner Coffee', 'River Roast', 'Studio Bean', 'Market Coffee', 'Oak Brew', 'Cloud Cup', 'Brick Coffee', 'Garden Roast', 'Metro Bean', 'Blue Mug', 'Hill Brew', 'Forest Coffee', 'Station Roast', 'Canvas Bean', 'Pier Coffee', 'Central Brew', 'Cedar Cup', 'Lake Roast', 'Field Coffee', 'North Brew'],
    metrics: ['에스프레소 품질', '필터 커피 품질', '좌석 여유', '콘센트 접근성', '와이파이 속도', '평균 음료 가격', '혼잡도', '영업시간', '디저트 만족도'],
    editions: ['평일', '주말', '상반기', '하반기', '연간'],
  },
  {
    key: 'hotels',
    category: 'travel',
    label: '도심 호텔',
    subcategories: ['room', 'service', 'price', 'location'],
    entities: ['Grand Central', 'Riverside Hotel', 'City Garden', 'Harbor View', 'Metro Palace', 'Skyline Hotel', 'Park Avenue', 'Royal Square', 'Urban Stay', 'Central Boutique', 'Lake House', 'Station Hotel', 'North Residence', 'South Terrace', 'Museum Hotel', 'Market Lodge', 'Canal House', 'Hill Residence', 'Pier Hotel', 'Garden Suites'],
    metrics: ['객실 청결도', '침대 편안함', '객실 면적', '조식 만족도', '체크인 속도', '교통 접근성', '평균 숙박비', '서비스 만족도', '부대시설 수'],
    editions: ['성수기', '비수기', '상반기', '하반기', '연간'],
  },
  {
    key: 'hiking-trails',
    category: 'outdoors',
    label: '하이킹 코스',
    subcategories: ['difficulty', 'scenery', 'access', 'crowding'],
    entities: ['Pine Ridge', 'River Loop', 'Granite Pass', 'Forest Line', 'Lake Circuit', 'Cedar Peak', 'Sunrise Trail', 'North Ridge', 'Meadow Walk', 'Cliff Route', 'Valley Path', 'Maple Course', 'Stone Ridge', 'Cloud Pass', 'Oak Loop', 'Harbor Hill', 'Wind Trail', 'Creek Path', 'Summit Line', 'Birch Route', 'Field Circuit', 'Canyon Walk'],
    metrics: ['난이도', '누적 상승고도', '소요 시간', '전망 만족도', '접근성', '주말 혼잡도', '그늘 비율', '노면 상태', '대중교통 접근성'],
    editions: ['봄', '여름', '가을', '겨울', '연간'],
  },
  {
    key: 'running-shoes',
    category: 'sports',
    label: '러닝화',
    subcategories: ['cushioning', 'stability', 'speed', 'durability'],
    entities: ['Nike Pegasus', 'Adidas Boston', 'Asics Nimbus', 'New Balance 1080', 'Saucony Triumph', 'Hoka Clifton', 'Brooks Ghost', 'Mizuno Wave Rider', 'On Cloudmonster', 'Puma Velocity', 'Reebok Floatride', 'Under Armour Infinite', 'Altra Torin', 'Topo Phantom', 'Salomon Aero'],
    metrics: ['쿠셔닝', '안정성', '에너지 리턴', '무게', '내구성', '젖은 노면 접지력', '통기성', '장거리 편안함', '템포런 적합성'],
    editions: ['2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'skincare-products',
    category: 'beauty',
    label: '스킨케어 제품',
    subcategories: ['cleanser', 'serum', 'moisturizer', 'sunscreen'],
    entities: ['Product Aloe', 'Product Birch', 'Product Cica', 'Product Dew', 'Product Elm', 'Product Fern', 'Product Grain', 'Product Herb', 'Product Iris', 'Product Jade', 'Product Kelp', 'Product Lotus', 'Product Moss', 'Product Nori', 'Product Oat', 'Product Pearl', 'Product Quartz', 'Product Rice', 'Product Sage', 'Product Tea', 'Product Ume', 'Product Vine', 'Product Willow', 'Product Yuzu'],
    metrics: ['보습 지속력', '사용감', '흡수 속도', '민감 피부 만족도', '메이크업 궁합', '유분감', '세정력', '백탁 정도', '눈시림 만족도'],
    editions: ['봄', '여름', '가을', '겨울', '연간'],
  },
  {
    key: 'mechanical-keyboards',
    category: 'technology',
    label: '기계식 키보드',
    subcategories: ['switch', 'sound', 'latency', 'build'],
    entities: ['Board Alpha', 'Board Bravo', 'Board Cedar', 'Board Delta', 'Board Echo', 'Board Frost', 'Board Grove', 'Board Harbor', 'Board Indigo', 'Board Juniper', 'Board Kilo', 'Board Lotus', 'Board Maple', 'Board Nova', 'Board Orbit', 'Board Pine', 'Board Quartz', 'Board River'],
    metrics: ['스위치 타건감', '타건음', '입력 지연', '무선 지연', '빌드 품질', '키캡 품질', '배터리 지속시간', '무게', '흡음 성능'],
    editions: ['2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'marketplaces',
    category: 'commerce',
    label: '온라인 마켓플레이스',
    subcategories: ['selection', 'price', 'delivery', 'support'],
    entities: ['Market Aster', 'Market Bridge', 'Market Circle', 'Market Dock', 'Market Elm', 'Market Field', 'Market Grove', 'Market Hub', 'Market Island', 'Market Junction', 'Market Kite', 'Market Lane', 'Market Metro', 'Market North', 'Market Oak', 'Market Port'],
    metrics: ['상품 수', '평균 가격 경쟁력', '배송 속도', '무료배송 비율', '반품 처리 속도', '고객 지원 응답시간', '판매자 수', '리뷰 작성률'],
    editions: ['2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'programming-languages',
    category: 'technology',
    label: '프로그래밍 언어',
    subcategories: ['ecosystem', 'performance', 'jobs', 'learning'],
    entities: ['Python', 'JavaScript', 'TypeScript', 'Java', 'C#', 'C++', 'C', 'Go', 'Rust', 'Kotlin', 'Swift', 'Ruby', 'PHP', 'Dart', 'Scala', 'R', 'Julia', 'Elixir', 'Haskell', 'Lua'],
    metrics: ['패키지 생태계 규모', '실행 성능', '채용 공고 수', '학습 자료 수', '오픈소스 저장소 수', '개발자 선호도', '웹 개발 사용률', '모바일 개발 사용률'],
    editions: ['2021', '2022', '2023', '2024', '2025', '2026'],
  },
  {
    key: 'board-games',
    category: 'games',
    label: '보드게임',
    subcategories: ['strategy', 'family', 'complexity', 'replay'],
    entities: ['Game Alder', 'Game Birch', 'Game Cedar', 'Game Dune', 'Game Elm', 'Game Fjord', 'Game Grove', 'Game Harbor', 'Game Isle', 'Game Juniper', 'Game Keep', 'Game Lotus', 'Game Mesa', 'Game North', 'Game Oak', 'Game Prairie', 'Game Quartz', 'Game Ridge', 'Game Stone', 'Game Vale', 'Game Willow', 'Game Zenith'],
    metrics: ['전략성', '가족 친화도', '규칙 복잡도', '평균 플레이시간', '리플레이성', '2인 플레이 만족도', '구성품 품질', '설명 난이도'],
    editions: ['입문', '중급', '숙련', '연간'],
  },
  {
    key: 'public-libraries',
    category: 'culture',
    label: '공공도서관',
    subcategories: ['collection', 'access', 'space', 'programs'],
    entities: ['Central Library', 'River Library', 'North Library', 'South Library', 'Garden Library', 'Station Library', 'Harbor Library', 'Hill Library', 'Market Library', 'Lake Library', 'Forest Library', 'Museum Library', 'Park Library', 'University Library', 'Civic Library', 'Canal Library', 'West Library', 'East Library', 'Square Library', 'Metro Library', 'Community Library', 'Archive Library', 'Bridge Library', 'Field Library', 'Coast Library', 'Valley Library', 'Maple Library', 'Oak Library'],
    metrics: ['장서 수', '전자책 수', '좌석 수', '주간 운영시간', '대중교통 접근성', '프로그램 수', '아동 자료 비율', '스터디 공간 수'],
    editions: ['2021', '2022', '2023', '2024', '2025'],
  },
]

function buildProjection(input: {
  rankingId: string
  world: HoldoutWorld
  metric: string
  subcategory: string
  rankingType: 'metric' | 'user_vote'
  edition: string | null
}) : Rf1mHoldoutSemanticProjection {
  const subject = `${input.world.key}:${slug(input.metric)}:${slug(input.subcategory)}`
  const edition = input.edition ?? 'undated'
  return {
    ranking_id: input.rankingId,
    subject_key: subject,
    classification_state: 'reviewed',
    confidence: 1,
    claim_signature: `${subject}:claim:${input.rankingType}`,
    view_signature: `${subject}:view:${slug(input.subcategory)}`,
    version_signature: `${subject}:version:${slug(edition)}`,
  }
}

function buildWorldRankings(world: HoldoutWorld) {
  const worldRandom = createRandom(`${RF1M_GENERATOR_SEED}:${world.key}:world`)
  const rankingCount = 4 + Math.floor(worldRandom() * 10)
  const rankings: Rf1mHoldoutRanking[] = []

  for (let index = 0; index < rankingCount; index += 1) {
    const rankingSeed = `${RF1M_GENERATOR_SEED}:${world.key}:ranking:${index + 1}`
    const random = createRandom(rankingSeed)
    const metric = choose(world.metrics, `${rankingSeed}:metric`)
    const subcategory = choose(world.subcategories, `${rankingSeed}:subcategory`)
    const includeEdition = random() < 0.64
    const edition = includeEdition ? choose(world.editions, `${rankingSeed}:edition`) : null
    const rankingType: 'metric' | 'user_vote' = random() < 0.83 ? 'metric' : 'user_vote'
    const maximumItems = Math.min(12, world.entities.length)
    const itemCount = 3 + Math.floor(Math.pow(random(), 1.18) * (maximumItems - 2))
    const selectedEntities = sample(world.entities, itemCount, `${rankingSeed}:items`)
    const id = `rf1m-${world.key}-${String(index + 1).padStart(2, '0')}`
    const engagement = longTailEngagement(rankingSeed)
    const titleParts = [edition, world.label, metric].filter(Boolean)
    const title = rankingType === 'user_vote'
      ? `${titleParts.join(' ')} 사용자 투표`
      : `${titleParts.join(' ')} TOP ${itemCount}`

    rankings.push({
      id,
      worldKey: world.key,
      categoryId: `cat-${world.category}`,
      subcategoryId: `sub-${world.category}-${subcategory}`,
      title,
      rankingType,
      itemIds: selectedEntities.map((entity) => `${world.key}:item:${slug(entity)}`),
      publishedAt: irregularPublishedAt(rankingSeed),
      uniqueViewCount: engagement.uniqueViewCount,
      likeCount: engagement.likeCount,
      bookmarkCount: engagement.bookmarkCount,
      recentExposureCount: engagement.recentExposureCount,
      semanticProjection: buildProjection({
        rankingId: id,
        world,
        metric,
        subcategory,
        rankingType,
        edition,
      }),
    })
  }

  return rankings
}

export function buildRf1mMixedHoldoutCorpus(): Rf1mMixedHoldoutCorpus {
  const rankings = WORLDS.flatMap(buildWorldRankings)
  return {
    corpusId: RF1M_CORPUS_ID,
    generatorSeed: RF1M_GENERATOR_SEED,
    referenceTime: RF1M_REFERENCE_TIME,
    generationBoundary: RF1M_GENERATION_BOUNDARY,
    worldCount: WORLDS.length,
    rankings,
  }
}

export const RF1M_MIXED_HOLDOUT_CORPUS_V1 = buildRf1mMixedHoldoutCorpus()
