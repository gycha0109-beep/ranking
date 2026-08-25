import type { ContentFamilySeed } from './schema'

export const CONTENT_CORPUS_200_FAMILIES_03: ContentFamilySeed[] = [
  {
    familyId: 'electric-vehicles', worldKey: 'mobility', label: '전기차', categorySlug: 'mobility', subcategorySlug: 'electric-vehicles', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Current EV models with comparable model-year/market data; exact trims frozen before calculation.',
    sourceKeys: ['epa-fueleconomy', 'vehicle-official-specs', 'vehicle-safety-official'],
    contentRationale: '구매 의도가 높고 객관 사양과 생활 시나리오의 결합이 강함.',
    facts: [
      ['2026 전기차 공인 주행거리 상위 모델', 'official range', ['공인 주행거리'], '2026 model-year'],
      ['2026 전기차 전비가 좋은 모델', 'official efficiency', ['공인 전비'], '2026 model-year'],
      ['2026 전기차 정부 안전평가 상위 모델', 'official safety rating', ['안전평가'], '2026/current'],
    ],
    editorials: [
      ['장거리 여행하기 좋은 전기차', '고속도로 주행거리·충전·승차감이 장거리에서 좋은가?', ['고속 주행거리', '급속충전', '승차감', '적재공간', '충전망 적합성']],
      ['아파트 생활에 덜 불편한 전기차', '매일 집에서 충전하지 못해도 운용 부담이 적은가?', ['주행거리', '충전속도', '효율', '충전 계획 유연성']],
      ['아이 한두 명 있는 가족에게 좋은 전기차', '카시트·짐·안전·2열 공간을 함께 만족하는가?', ['2열 공간', '트렁크', '안전', '승차감', '주행거리']],
      ['가격 대비 만족도가 높은 전기차', '가격과 주행거리·공간·기능을 비교했을 때 균형이 좋은가?', ['가격', '주행거리', '공간', '기본사양', '충전']],
    ],
    votes: [
      ['디자인이 가장 예쁜 전기차', '현재 판매 전기차 중 디자인이 가장 마음에 드는 모델은?'],
      ['지금 가장 사고 싶은 전기차', '지금 전기차를 하나 산다면 가장 사고 싶은 모델은?'],
      ['드림카로 갖고 싶은 전기차', '현실 예산을 무시하면 가장 갖고 싶은 전기차는?'],
    ],
  },
  {
    familyId: 'airports', worldKey: 'travel', label: '국제공항', categorySlug: 'travel-transport', subcategorySlug: 'airports', taxonomyStatus: 'EXISTING',
    candidateUniverseStrategy: 'Major international airports with comparable ACI/operator data in the selected year.',
    sourceKeys: ['aci-airport-ranking', 'airport-official-statistics'],
    contentRationale: '기존 이용객 수 Fact를 넘어 환승·체류 경험으로 확장 가능.',
    facts: [
      ['2025 국제선 이용객이 많은 공항', 'international passengers', ['국제선 이용객'], '2025'],
      ['2025 항공기 운항 횟수가 많은 공항', 'aircraft movements', ['항공기 운항 횟수'], '2025'],
      ['직항 취항 도시가 많은 국제공항', 'destinations served', ['직항 취항 도시 수'], 'current/frozen'],
    ],
    editorials: [
      ['환승하기 편한 국제공항', '짧은 환승에서 이동 동선과 안내가 편한 공항은?', ['환승 동선', '터미널 연결', '표지', '최소 연결시간', '보안 재검색']],
      ['첫 해외여행 때 덜 헤매는 공항', '해외여행 초보자가 도착·출국 절차를 이해하기 쉬운가?', ['표지', '입국 동선', '교통 연결', '안내', '언어']],
      ['먹고 쇼핑하며 시간 보내기 좋은 공항', '긴 대기시간을 소비하기 좋은 식음·쇼핑 선택지가 있는가?', ['식음 다양성', '쇼핑', '가격대', '영업시간']],
      ['밤샘 환승 버티기 좋은 공항', '심야 체류에 필요한 휴식·샤워·24시간 시설이 있는가?', ['휴식공간', '24시간 시설', '샤워', '안전', '충전']],
    ],
    votes: [
      ['가장 좋아하는 국제공항', '이용해 본 공항 중 가장 좋아하는 국제공항은?'],
      ['터미널 디자인이 가장 멋진 공항', '공간 디자인이 가장 인상적인 국제공항은?'],
      ['일부러 다시 가보고 싶은 공항', '공항 자체 경험 때문에 다시 들르고 싶은 곳은?'],
    ],
  },
  {
    familyId: 'asian-cities', worldKey: 'travel', label: '아시아·세계 도시', categorySlug: 'statistics', subcategorySlug: 'world-cities', taxonomyStatus: 'EXISTING',
    candidateUniverseStrategy: 'Major Asian/global cities with comparable official tourism/transport/statistical evidence.',
    sourceKeys: ['undesa-world-cities', 'city-official-statistics', 'tourism-official-statistics'],
    contentRationale: '여행 선택 문제와 도시 Fact를 함께 연결할 수 있음.',
    facts: [
      ['아시아 주요 도시 국제관광객 수 상위 도시', 'official international visitor count', ['국제관광객 수'], 'latest comparable year'],
      ['아시아 주요 도시 대중교통 이용 지표가 높은 도시', 'comparable public transport usage', ['대중교통 이용 지표'], 'latest comparable year'],
      ['아시아 주요 도시 호텔 공급 규모가 큰 도시', 'hotel rooms/supply', ['호텔 객실 수'], 'latest comparable year'],
    ],
    editorials: [
      ['3박 4일로 만족도 높은 아시아 도시', '짧은 일정에서 이동 시간 대비 볼거리·먹거리 밀도가 높은가?', ['공항 접근', '도시 이동', '핵심 볼거리 밀도', '먹거리', '3박4일 동선']],
      ['혼자 여행하기 편한 아시아 도시', '혼자 이동·식사·숙박하기 부담이 적은가?', ['치안/안내', '대중교통', '혼밥', '숙박 선택', '언어 접근성']],
      ['첫 해외여행으로 가기 좋은 아시아 도시', '해외여행 초보자가 예약부터 귀국까지 난도가 낮은가?', ['항공 접근', '입국 절차', '교통', '언어', '결제']],
      ['먹으러 여행 가기 좋은 아시아 도시', '짧은 일정에서도 다양한 대표 음식을 쉽게 경험할 수 있는가?', ['음식 다양성', '접근성', '가격대', '야간 식문화', '시장/거리']],
    ],
    votes: [
      ['다시 가고 싶은 아시아 도시', '여행했던 도시 중 다시 가고 싶은 아시아 도시는?'],
      ['한 달 살아보고 싶은 아시아 도시', '한 달 살 기회가 있다면 가장 살아보고 싶은 도시는?'],
      ['밤 분위기가 가장 좋은 아시아 도시', '야간 산책·야경·식문화 분위기가 가장 좋은 도시는?'],
    ],
  },
  {
    familyId: 'instant-noodles', worldKey: 'food', label: '봉지·컵라면', categorySlug: 'foods', subcategorySlug: null, taxonomyStatus: 'EXISTING',
    candidateUniverseStrategy: 'Widely distributed Korean-market instant noodles with current official product labels.',
    sourceKeys: ['food-official-labels'],
    contentRationale: '인지도가 높고 영양 Fact·상황별 추천·취향 투표를 모두 만들기 쉬움.',
    facts: [
      ['한국 라면 나트륨이 낮은 제품 순위', 'nutrition label sodium ascending', ['나트륨'], 'current label'],
      ['한국 라면 단백질이 높은 제품 순위', 'nutrition label protein', ['단백질'], 'current label'],
      ['한국 라면 칼로리가 낮은 제품 순위', 'nutrition label calories ascending', ['열량'], 'current label'],
    ],
    editorials: [
      ['맵찔이도 맛있게 먹기 좋은 라면', '매운맛 부담이 낮으면서 맛의 존재감이 충분한가?', ['매운맛 부담', '국물/소스 맛', '대중성', '조리 난이도']],
      ['해장할 때 당기는 국물 라면', '국물감과 향·매운맛이 해장 상황에 잘 맞는가?', ['국물 진함', '칼칼함', '면', '건더기', '해장 체감']],
      ['계란 하나 넣었을 때 더 맛있는 라면', '계란을 넣었을 때 국물·면과 궁합이 좋아지는가?', ['국물 궁합', '간 변화', '면 궁합', '조리 안정성']],
      ['늦은 밤 부담 덜한 라면', '야식으로 먹을 때 양·열량·매운맛 부담이 상대적으로 낮은가?', ['열량', '나트륨', '양', '매운맛', '포만감']],
    ],
    votes: [
      ['국물 라면 원탑', '국물 라면 하나만 고른다면 무엇입니까?'],
      ['볶음라면 원탑', '볶음라면 하나만 고른다면 무엇입니까?'],
      ['평생 하나만 먹을 라면', '평생 라면 하나만 먹을 수 있다면?'],
    ],
  },
  {
    familyId: 'convenience-protein', worldKey: 'food', label: '편의점 고단백 식품', categorySlug: 'foods', subcategorySlug: null, taxonomyStatus: 'EXISTING',
    candidateUniverseStrategy: 'Korean convenience-store products with current official nutrition/product pages.',
    sourceKeys: ['convenience-official-products', 'food-official-labels'],
    contentRationale: '실용 구매·운동/식사 상황에 직접 연결되는 소비형 콘텐츠.',
    facts: [
      ['편의점 고단백 식품 단백질 함량 순위', 'protein grams', ['단백질'], 'current'],
      ['편의점 고단백 식품 칼로리 대비 단백질 순위', 'protein per kcal', ['단백질', '열량'], 'current'],
      ['편의점 고단백 식품 나트륨이 낮은 순위', 'sodium ascending', ['나트륨'], 'current'],
    ],
    editorials: [
      ['편의점에서 운동 후 먹기 좋은 고단백 조합', '운동 후 단백질과 탄수화물을 간단히 맞추기 좋은 조합은?', ['단백질', '탄수화물', '열량', '가격', '섭취 편의']],
      ['아침 대용으로 먹기 좋은 편의점 단백질 식품', '아침에 빠르게 먹으면서 포만감과 영양 균형이 좋은가?', ['단백질', '열량', '포만감', '휴대성', '가격']],
      ['야식으로 부담 덜한 편의점 고단백 식품', '늦은 시간에도 양·열량·나트륨 부담이 낮은가?', ['단백질', '열량', '나트륨', '포만감']],
      ['회사 책상에서 먹기 편한 고단백 간식', '냄새·조리·보관 부담 없이 업무 중 먹기 좋은가?', ['냄새', '조리 필요', '보관', '단백질', '가격']],
    ],
    votes: [
      ['맛이 가장 좋은 편의점 고단백 식품', '단백질 식품 중 맛만 보면 무엇이 가장 좋습니까?'],
      ['재구매하고 싶은 편의점 단백질 식품', '가격까지 생각했을 때 다시 살 제품은?'],
      ['편의점 한 끼 원탑', '편의점에서 단백질 챙겨 한 끼 먹는다면 가장 만족스러운 선택은?'],
    ],
  },
]
