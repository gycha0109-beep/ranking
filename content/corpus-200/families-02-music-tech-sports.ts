import type { ContentFamilySeed } from './schema'

export const CONTENT_CORPUS_200_FAMILIES_02: ContentFamilySeed[] = [
  {
    familyId: 'kpop-artists-albums', worldKey: 'music', label: 'K-pop 아티스트·앨범', categorySlug: 'music', subcategorySlug: 'kpop-artists', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Artists/albums with manually reviewed Circle Chart evidence and official release pages.',
    sourceKeys: ['circle-chart', 'artist-official-pages'],
    contentRationale: '팬덤 투표와 앨범·공연 관점의 editorial 콘텐츠를 만들기 좋음.',
    facts: [
      ['2026 Circle 앨범 차트 누적 판매 상위 K-pop 앨범', 'Circle album sales', ['앨범 판매량'], '2026'],
      ['이번 달 Circle 앨범 차트 상위 K-pop 앨범', 'Circle monthly album rank', ['월간 앨범 순위'], 'monthly'],
      ['2026 Circle 글로벌 K-pop 차트에 가장 자주 등장한 아티스트', 'count appearances in frozen chart snapshots', ['글로벌 차트 등장 횟수'], '2026'],
    ],
    editorials: [
      ['처음 입덕하기 쉬운 K-pop 그룹', '처음 접하는 사람이 멤버·음악·콘텐츠를 따라가기 쉬운 그룹은?', ['대표곡 접근성', '멤버 구분', '콘텐츠 접근성', '입문 동선']],
      ['무대 보는 맛이 가장 강한 K-pop 그룹', '음원보다 무대에서 강점이 더 선명해지는 그룹은?', ['퍼포먼스', '라이브 전달력', '안무 가독성', '무대 연출']],
      ['실물 앨범 소장 만족도가 높은 K-pop 앨범', '패키지·구성·디자인 때문에 실물 소장 가치가 높은 앨범은?', ['패키지 디자인', '구성품', '사진/아트', '보관성']],
      ['라이브 공연으로 꼭 보고 싶은 K-pop 아티스트', '공연장에서 체감할 퍼포먼스와 곡 구성이 강한 아티스트는?', ['라이브력', '셋리스트 폭', '퍼포먼스', '관객 상호작용']],
      ['해외 친구에게 한 팀만 소개하기 좋은 K-pop 그룹', 'K-pop을 모르는 해외 친구에게 한 팀만 보여준다면?', ['대표성', '접근성', '비주얼/퍼포먼스', '곡 다양성']],
    ],
    votes: [
      ['지금 가장 좋아하는 K-pop 그룹', '현재 가장 좋아하는 K-pop 그룹은?'],
      ['콘서트 티켓 하나만 살 수 있다면', 'K-pop 콘서트 하나만 갈 수 있다면 누구를 고르시겠습니까?'],
    ],
  },
  {
    familyId: 'smartphones', worldKey: 'technology', label: '스마트폰', categorySlug: 'technology', subcategorySlug: 'smartphones', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Current flagship and upper-mid devices with exact model/region frozen at materialization.',
    sourceKeys: ['geekbench-mobile', 'geekbench-gpu', 'device-official-specs'],
    contentRationale: '비교·구매 의도가 강하고 성능 Fact와 사용 목적별 editorial이 잘 결합됨.',
    facts: [
      ['2026 플래그십 스마트폰 Geekbench 싱글코어 성능', 'Geekbench single-core', ['싱글코어 점수'], '2026 current models'],
      ['2026 플래그십 스마트폰 Geekbench 멀티코어 성능', 'Geekbench multi-core', ['멀티코어 점수'], '2026 current models'],
      ['2026 플래그십 스마트폰 공식 무게가 가벼운 순위', 'official device weight ascending', ['무게(g)'], '2026'],
    ],
    editorials: [
      ['게임하기 좋은 2026 플래그십 스마트폰', '장시간 모바일 게임에서 성능·발열·배터리 균형이 좋은가?', ['CPU/GPU', '발열 억제', '배터리', '화면', '게임 기능']],
      ['여행 카메라로 쓰기 좋은 스마트폰', '여행 중 사진·영상·줌·배터리를 한 기기로 해결하기 좋은가?', ['카메라 범용성', '줌', '동영상', '배터리', '무게']],
      ['한 손으로 쓰기 편한 플래그십 스마트폰', '작은 손에서도 그립과 무게 부담이 적은가?', ['폭', '무게', '화면 크기', '그립', '버튼 접근']],
      ['충전 자주 하기 싫은 사람에게 좋은 스마트폰', '실사용 지속시간과 충전 편의가 좋은가?', ['배터리 용량/테스트', '충전 속도', '대기 효율', '발열']],
      ['가격 생각 안 하면 완성도 높은 플래그십 스마트폰', '가격을 제외하고 전반적 약점이 적은가?', ['성능', '카메라', '배터리', '디스플레이', '소프트웨어']],
    ],
    votes: [
      ['2026 디자인이 가장 예쁜 스마트폰', '2026 플래그십 중 디자인이 가장 마음에 드는 제품은?'],
      ['지금 하나 공짜로 준다면 고를 스마트폰', '가격 무시하고 지금 하나 받을 수 있다면 무엇을 고르시겠습니까?'],
    ],
  },
  {
    familyId: 'laptops', worldKey: 'technology', label: '노트북', categorySlug: 'technology', subcategorySlug: 'laptops', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Current premium/mainstream laptops with exact CPU/GPU/configuration frozen at materialization.',
    sourceKeys: ['geekbench-mobile', 'device-official-specs'],
    contentRationale: '개발·학교·출장 등 사용 목적별 랭킹 수요가 명확함.',
    facts: [
      ['2026 프리미엄 노트북 공식 무게가 가벼운 순위', 'official weight ascending', ['무게'], '2026'],
      ['2026 프리미엄 노트북 CPU 벤치마크 상위 모델', 'comparable CPU benchmark', ['CPU 벤치마크'], '2026'],
      ['2026 프리미엄 노트북 공식 최대 배터리 사용시간', 'manufacturer battery claim with test method note', ['공식 배터리 시간'], '2026'],
    ],
    editorials: [
      ['개발자가 들고 다니기 좋은 노트북', 'IDE·컨테이너·브라우저를 돌리면서 휴대하기 좋은가?', ['CPU', '메모리 구성', '키보드', '포트', '무게']],
      ['대학생이 4년 쓰기 좋은 노트북', '수업·과제·휴대·내구성 관점에서 장기 사용에 무난한가?', ['무게', '배터리', '내구성', '성능 여유', 'AS']],
      ['영상 편집 입문자가 사기 좋은 노트북', '초중급 편집에서 성능과 가격·화면의 균형이 좋은가?', ['CPU/GPU', '디스플레이', '메모리', '저장장치', '가격']],
      ['출장이 잦은 사람에게 좋은 노트북', '비행·카페·호텔 이동에서 부담이 적은가?', ['무게', '배터리', '충전기', '포트', '내구성']],
      ['조용한 공간에서 쓰기 좋은 노트북', '도서관·회의실에서 발열과 팬 소음 부담이 적은가?', ['팬 소음', '저부하 발열', '키보드 소음', '배터리']],
    ],
    votes: [
      ['디자인이 가장 마음에 드는 노트북', '현재 노트북 중 디자인만 보면 무엇이 가장 마음에 드십니까?'],
      ['지금 새 노트북 하나 산다면', '예산을 잠시 무시하고 지금 하나 산다면 무엇을 고르시겠습니까?'],
    ],
  },
  {
    familyId: 'kbo-clubs', worldKey: 'sports', label: 'KBO 구단', categorySlug: 'sports', subcategorySlug: 'kbo', taxonomyStatus: 'EXISTING',
    candidateUniverseStrategy: 'All current KBO clubs for the frozen season; no candidate pruning based on recommendation behavior.',
    sourceKeys: ['kbo-official-record', 'kbo-live-stats'],
    contentRationale: '기존 production KBO 콘텐츠와 자연스러운 version/view 관계를 만들 수 있음.',
    facts: [
      ['2026 KBO 팀 OPS 상위 구단', 'team OPS', ['팀 OPS'], '2026'],
      ['2026 KBO 팀 홈런 상위 구단', 'team home runs', ['팀 홈런'], '2026'],
      ['2026 KBO 불펜 평균자책점이 좋은 구단', 'bullpen ERA ascending', ['불펜 평균자책점'], '2026'],
    ],
    editorials: [
      ['야구 처음 보는 사람이 응원 시작하기 좋은 KBO 구단', '처음 팬이 될 때 경기·선수·응원 문화를 따라가기 쉬운 팀은?', ['스타 접근성', '응원 문화', '콘텐츠 접근성', '경기 재미']],
      ['홈런 보는 맛이 강한 KBO 구단', '장타와 득점 장면을 기대하는 팬에게 재미가 큰 팀은?', ['홈런', '장타율', '득점력', '중심타선']],
      ['투수전 좋아하는 팬이 보기 좋은 KBO 구단', '선발·불펜 운영과 저실점 경기를 즐기기 좋은 팀은?', ['선발 안정성', '불펜', '수비', '저실점 경기']],
      ['원정팬으로 따라다니기 좋은 KBO 구단', '원정 관람 시 접근성과 팬 경험이 좋은 팀은?', ['원정 일정', '교통', '팬 커뮤니티', '응원 편의']],
      ['가족과 야구장 가기 좋은 KBO 구단', '가족 단위 관람에서 시설과 경험이 좋은 팀은?', ['구장 접근성', '좌석/시설', '먹거리', '이벤트']],
    ],
    votes: [
      ['KBO 응원 문화가 가장 재미있는 구단', '응원 문화가 가장 재미있다고 생각하는 KBO 구단은?'],
      ['KBO 유니폼이 가장 예쁜 구단', '현재 유니폼 디자인이 가장 마음에 드는 KBO 구단은?'],
    ],
  },
  {
    familyId: 'fifa-national-teams', worldKey: 'sports', label: 'FIFA 국가대표', categorySlug: 'sports', subcategorySlug: 'fifa', taxonomyStatus: 'EXISTING',
    candidateUniverseStrategy: 'National teams participating in the frozen tournament/ranking period with official FIFA evidence.',
    sourceKeys: ['fifa-official-ranking', 'fifa-match-statistics'],
    contentRationale: '기존 FIFA 랭킹과 다른 경기 스타일·대회 성과 관점으로 확장 가능.',
    facts: [
      ['2026 월드컵 경기당 득점이 높은 국가대표', 'tournament goals per match', ['경기당 득점'], '2026 tournament'],
      ['2026 월드컵 경기당 실점이 적은 국가대표', 'goals conceded per match ascending', ['경기당 실점'], '2026 tournament'],
      ['2026 월드컵 유효슈팅이 많은 국가대표', 'shots on target', ['유효슈팅'], '2026 tournament'],
    ],
    editorials: [
      ['공격 축구 보는 맛이 좋은 국가대표', '공격 전개와 박스 진입이 적극적인 팀은?', ['득점', '슈팅', '전진성', '공격 전환']],
      ['역습 보는 맛이 좋은 국가대표', '공을 뺏은 뒤 빠르게 위협적인 장면을 만드는 팀은?', ['전환 속도', '직선성', '속도 자원', '역습 완성도']],
      ['스타 선수 보는 재미가 큰 국가대표', '세계적 스타와 역할 분담이 관전 포인트가 되는 팀은?', ['스타 파워', '공격 핵심', '전술 역할', '선수 인지도']],
      ['축구 입문자가 경기 보기 좋은 국가대표', '전술을 몰라도 경기 특징과 스타가 잘 보이는 팀은?', ['스타 접근성', '경기 속도', '전술 가독성', '득점 기대']],
      ['다시 보기 좋은 2026 월드컵 국가대표', '하이라이트와 풀매치 재관람 가치가 높은 팀은?', ['명승부', '득점 장면', '전술 변화', '서사']],
    ],
    votes: [
      ['2026 월드컵 가장 재미있던 국가대표', '2026 월드컵에서 경기가 가장 재미있었던 국가는?'],
      ['국가대표 유니폼이 가장 예쁜 팀', '2026 대회 유니폼이 가장 마음에 든 국가는?'],
    ],
  },
]
