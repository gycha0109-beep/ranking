import type { ContentFamilySeed } from './schema'

export const CONTENT_CORPUS_200_FAMILIES_04: ContentFamilySeed[] = [
  {
    familyId: 'sunscreens', worldKey: 'beauty', label: '선크림', categorySlug: 'beauty', subcategorySlug: 'sunscreen', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Current Korean-market sunscreen products with official product claims and comparable package data.',
    sourceKeys: ['beauty-official-products', 'beauty-retail-pricing'],
    contentRationale: '사용감·메이크업·재구매처럼 투표와 editorial 수요가 강함.',
    facts: [
      ['선크림 용량 대비 가격이 낮은 제품 순위', 'price per ml', ['가격', '용량'], 'current snapshot'],
      ['선크림 공식 용량이 큰 제품 순위', 'package volume', ['용량'], 'current'],
      ['선크림 공식 SPF·PA 표기가 높은 제품 비교', 'declared SPF/PA categorical comparison', ['SPF', 'PA'], 'current'],
    ],
    editorials: [
      ['지성 피부가 여름에 쓰기 편한 선크림', '유분·끈적임·무너짐 부담이 적은가?', ['유분감', '끈적임', '마무리', '지속성', '세안']],
      ['메이크업 전에 쓰기 좋은 선크림', '베이스 메이크업과 밀림·들뜸 없이 잘 맞는가?', ['흡수', '밀림', '백탁', '유분', '메이크업 궁합']],
      ['백탁 싫은 사람이 고르기 좋은 선크림', '피부톤 변화가 적고 덧바르기 쉬운가?', ['백탁', '투명도', '덧바름', '사용감']],
      ['자주 덧바르기 편한 선크림', '외출 중 손쉽게 덧바를 때 뭉침·끈적임이 적은가?', ['덧바름', '휴대성', '뭉침', '마무리']],
    ],
    votes: [
      ['사용감이 가장 좋은 선크림', '발림성과 마무리감이 가장 마음에 드는 선크림은?'],
      ['재구매한 선크림', '실제로 다시 사고 싶은 선크림은?'],
      ['하나만 남긴다면 고를 선크림', '선크림 하나만 쓸 수 있다면 무엇을 고르시겠습니까?'],
    ],
  },
  {
    familyId: 'skincare-serums', worldKey: 'beauty', label: '세럼·앰플', categorySlug: 'beauty', subcategorySlug: 'serum-ampoule', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Current Korean-market serum/ampoule products with official declared ingredients/claims.',
    sourceKeys: ['beauty-official-products', 'beauty-retail-pricing'],
    contentRationale: '피부 타입별 목적이 뚜렷하고 제품 overlap이 자연스럽게 발생.',
    facts: [
      ['세럼·앰플 10ml당 가격이 낮은 제품 순위', 'price per 10ml', ['가격', '용량'], 'current snapshot'],
      ['세럼·앰플 공식 용량이 큰 제품 순위', 'package volume', ['용량'], 'current'],
      ['공식 페이지에 핵심 성분 함량을 명시한 세럼 비교', 'declared active amount where explicitly stated', ['핵심 성분 표기'], 'current'],
    ],
    editorials: [
      ['민감 피부 입문자가 시작하기 무난한 세럼', '복잡한 루틴 없이 자극 부담을 낮추며 시작하기 쉬운가?', ['성분 단순성', '향/자극 요소', '사용감', '공식 사용법']],
      ['건조할 때 보습 레이어링하기 좋은 세럼', '크림 전 단계에서 수분·보습 레이어를 만들기 좋은가?', ['보습 성분', '점도', '흡수', '레이어링']],
      ['지성 피부가 답답하지 않게 쓰기 좋은 세럼', '유분감과 막감이 적으면서 관리 목적을 충족하는가?', ['유분감', '점도', '흡수', '마무리']],
      ['세럼 처음 사는 사람이 고르기 쉬운 제품', '용도와 사용법이 명확하고 다른 제품과 조합하기 쉬운가?', ['목적 명확성', '사용법', '가격', '레이어링', '접근성']],
    ],
    votes: [
      ['흡수감이 가장 마음에 드는 세럼', '바른 뒤 흡수감이 가장 마음에 드는 세럼은?'],
      ['재구매하고 싶은 세럼', '다 쓰고 다시 사고 싶은 세럼·앰플은?'],
      ['패키지가 가장 예쁜 세럼', '패키지 디자인이 가장 마음에 드는 세럼은?'],
    ],
  },
  {
    familyId: 'streaming-services', worldKey: 'subscriptions', label: 'OTT 스트리밍 서비스', categorySlug: 'media', subcategorySlug: 'streaming-services', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Major streaming services sold in Korea with current official pricing and feature pages.',
    sourceKeys: ['streaming-official-pricing', 'streaming-official-features'],
    contentRationale: '가격·기능 Fact와 실제 구독 선택 질문이 직접 연결됨.',
    facts: [
      ['한국 OTT 월 구독료가 낮은 기본 요금제 순위', 'monthly price', ['월 구독료'], 'current'],
      ['한국 OTT 동시접속 가능 인원이 많은 요금제 순위', 'simultaneous streams', ['동시접속 수'], 'current'],
      ['한국 OTT 4K 이용 가능 최저 요금 비교', 'lowest plan supporting 4K', ['4K 가능 최저 월요금'], 'current'],
    ],
    editorials: [
      ['가족이 같이 쓰기 좋은 OTT', '여러 명이 프로필·동시접속·콘텐츠를 나눠 쓰기 좋은가?', ['동시접속', '프로필', '키즈', '가격', '콘텐츠 폭']],
      ['한국 드라마 많이 보는 사람에게 좋은 OTT', '한국 드라마 카탈로그와 신작 접근성이 좋은가?', ['한국 드라마 폭', '신작', '독점', '가격']],
      ['영화 많이 보는 사람에게 좋은 OTT', '영화 카탈로그·화질·부가정보가 좋은가?', ['영화 폭', '4K', '고전/신작', '가격', 'UI']],
      ['휴대폰으로 주로 보는 사람에게 좋은 OTT', '모바일 앱·다운로드·데이터 사용 편의가 좋은가?', ['모바일 UI', '다운로드', '화질 조절', '이어보기', '가격']],
    ],
    votes: [
      ['가성비가 가장 좋다고 느끼는 OTT', '지금 가격 대비 가장 만족스러운 OTT는?'],
      ['마지막까지 해지 안 할 OTT', '구독을 하나만 남긴다면 어떤 OTT를 유지하시겠습니까?'],
      ['앱 UI가 가장 편한 OTT', '앱 사용성이 가장 편하다고 느끼는 OTT는?'],
    ],
  },
  {
    familyId: 'anc-headphones', worldKey: 'technology', label: '노이즈캔슬링 헤드폰', categorySlug: 'technology', subcategorySlug: 'headphones', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Current over-ear ANC headphones with official specs; independent lab source added only after license review.',
    sourceKeys: ['headphone-official-specs', 'headphone-review-lab'],
    contentRationale: '출퇴근·사무실·여행 등 사용 시나리오와 구매 의도가 강함.',
    facts: [
      ['노이즈캔슬링 헤드폰 공식 무게가 가벼운 순위', 'official weight ascending', ['무게'], 'current'],
      ['노이즈캔슬링 헤드폰 공식 배터리 시간이 긴 순위', 'official battery life', ['배터리 시간'], 'current'],
      ['노이즈캔슬링 헤드폰 유선·무선 코덱 지원 비교', 'official supported codecs/features', ['지원 코덱'], 'current'],
    ],
    editorials: [
      ['출퇴근 지하철에서 쓰기 좋은 헤드폰', '대중교통 소음과 장시간 착용에서 균형이 좋은가?', ['ANC', '착용감', '무게', '배터리', '휴대성']],
      ['사무실에서 오래 쓰기 좋은 헤드폰', '몇 시간 착용과 통화·멀티포인트에 적합한가?', ['착용감', '통화', '멀티포인트', '배터리', '압박']],
      ['장거리 비행에 좋은 노이즈캔슬링 헤드폰', '비행기 저역 소음·배터리·휴대가 좋은가?', ['ANC', '배터리', '케이스', '유선 사용', '착용감']],
      ['안경 쓰는 사람이 덜 불편한 헤드폰', '안경 다리 압박과 장시간 착용 부담이 적은가?', ['클램핑', '패드', '무게', '열감', '안경 간섭']],
    ],
    votes: [
      ['착용감이 가장 좋은 헤드폰', '오래 써도 가장 편한 헤드폰은?'],
      ['소리가 가장 마음에 드는 헤드폰', '개인 취향 기준 소리가 가장 좋은 헤드폰은?'],
      ['지금 가장 사고 싶은 헤드폰', '현재 하나 산다면 가장 사고 싶은 헤드폰은?'],
    ],
  },
  {
    familyId: 'fast-food', worldKey: 'food', label: '패스트푸드 메뉴·체인', categorySlug: 'foods', subcategorySlug: null, taxonomyStatus: 'EXISTING',
    candidateUniverseStrategy: 'Current Korean-market menu items from major chains with official nutrition/menu pages.',
    sourceKeys: ['fastfood-official-nutrition', 'fastfood-official-menu'],
    contentRationale: '영양 Fact와 맛·배달·야식 취향을 함께 다루기 쉬운 대중적 소재.',
    facts: [
      ['패스트푸드 버거 단백질 함량이 높은 메뉴 순위', 'official nutrition protein', ['단백질'], 'current'],
      ['패스트푸드 버거 칼로리가 낮은 메뉴 순위', 'official nutrition calories ascending', ['열량'], 'current'],
      ['패스트푸드 버거 나트륨이 낮은 메뉴 순위', 'official nutrition sodium ascending', ['나트륨'], 'current'],
    ],
    editorials: [
      ['배달 와도 맛이 덜 무너지는 패스트푸드 메뉴', '배달시간 뒤에도 식감과 온도 영향이 상대적으로 적은가?', ['배달 내구성', '식감', '소스 안정성', '재가열']],
      ['야식으로 만족감 높은 패스트푸드 메뉴', '늦은 밤 한 끼로 맛과 포만감이 좋은가?', ['포만감', '맛', '양', '가격', '부담감']],
      ['처음 가는 체인에서 실패 확률 낮은 대표 메뉴', '브랜드 특색을 알기 쉽고 호불호가 비교적 적은가?', ['대표성', '대중성', '가격', '구성']],
      ['치팅데이에 먹기 좋은 패스트푸드 메뉴', '칼로리 걱정을 내려놓았을 때 만족감이 극대화되는가?', ['풍미', '양', '식감', '사이드 궁합']],
    ],
    votes: [
      ['버거 원탑', '패스트푸드 버거 하나만 고른다면?'],
      ['감자튀김 원탑 체인', '감자튀김이 가장 맛있는 패스트푸드 체인은?'],
      ['평생 하나만 먹을 패스트푸드 체인', '패스트푸드 체인 하나만 남긴다면 어디를 고르시겠습니까?'],
    ],
  },
]
