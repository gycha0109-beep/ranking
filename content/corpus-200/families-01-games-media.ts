import type { ContentFamilySeed } from './schema'

export const CONTENT_CORPUS_200_FAMILIES_01: ContentFamilySeed[] = [
  {
    familyId: 'steam-mainstream', worldKey: 'games', label: 'Steam 메인스트림 게임', categorySlug: 'games', subcategorySlug: 'steam', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Steam current/recurring chart titles plus durable mainstream titles; exact candidate set is source-materialized later.',
    sourceKeys: ['steam-official-charts', 'steam-store-pages'],
    contentRationale: '현재성이 높고 게임별 겹침이 자연스럽게 발생해 탐색성이 강한 축.',
    facts: [
      ['지금 Steam에서 가장 많이 플레이되는 게임', 'peak/current players', ['동시 플레이어 수'], 'weekly/current'],
      ['이번 주 Steam 매출 상위 게임', 'weekly top sellers', ['주간 매출 순위'], 'weekly'],
      ['2026 Steam 신작 중 최고 동시접속 기록이 높은 게임', 'new release peak players', ['출시일', '최고 동시접속 기록'], '2026'],
    ],
    editorials: [
      ['친구 3~4명이 같이 시작하기 좋은 Steam 게임', '친구 3~4명이 새로 시작할 때 진입장벽과 협동 재미를 함께 고려하면 무엇이 좋은가?', ['협동 인원', '진입 난이도', '세션 길이', '반복 플레이성']],
      ['퇴근 후 1시간만 해도 만족감 높은 Steam 게임', '짧은 저녁 시간에도 한 세션의 완결감이 높은 게임은?', ['평균 세션 길이', '진행 저장 편의', '즉시성', '한 판 만족도']],
      ['100시간 넘게 파고들기 좋은 Steam 게임', '장기적으로 파고들 시스템과 반복 동기가 충분한 게임은?', ['콘텐츠 깊이', '빌드 다양성', '반복 플레이성', '업데이트 지속성']],
      ['방송으로 봐도 재미있는 Steam 게임', '직접 하지 않는 시청자에게도 상황 변화와 반응 포인트가 많은 게임은?', ['관전 가독성', '돌발 상황', '사회적 상호작용', '세션 변주']],
      ['저사양 PC에서도 오래 즐기기 좋은 Steam 게임', '높은 사양 없이도 장기적으로 즐길 수 있는 게임은?', ['최소 사양', '성능 안정성', '콘텐츠 깊이', '가격 접근성']],
    ],
    votes: [
      ['요즘 가장 끊기 힘든 Steam 게임', '요즘 가장 끊기 힘든 Steam 게임은?'],
      ['친구에게 딱 하나만 추천한다면 고를 Steam 게임', '친구에게 Steam 게임 딱 하나만 추천한다면?'],
    ],
  },
  {
    familyId: 'steam-coop-survival', worldKey: 'games', label: 'Steam 협동·생존 게임', categorySlug: 'games', subcategorySlug: 'coop-survival', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Steam co-op/survival titles identified from official store metadata and current charts; no overlap quota.',
    sourceKeys: ['steam-official-charts', 'steam-store-pages'],
    contentRationale: '친구와 할 게임이라는 실제 선택 문제를 중심으로 논쟁성과 저장 가치가 높음.',
    facts: [
      ['Steam 협동 게임 중 현재 플레이어가 많은 게임', 'current player count among co-op eligible titles', ['현재 플레이어 수'], 'current'],
      ['Steam 협동·생존 게임 중 리뷰가 가장 많이 쌓인 게임', 'official store review volume', ['리뷰 수'], 'current snapshot'],
      ['Steam 협동·생존 게임 최고 동시접속 기록 순위', 'peak concurrency', ['최고 동시접속 기록'], 'all-time/current eligible'],
    ],
    editorials: [
      ['둘이서 시작하기 가장 좋은 협동 게임', '2인 플레이에서 빈자리 체감 없이 재미가 완성되는가?', ['2인 완성도', '역할 분담', '진입 난이도', '세션 길이']],
      ['4명이 모였을 때 가장 난장판 되는 협동 게임', '4인 파티에서 상호작용과 돌발 상황이 가장 많이 생기는가?', ['4인 상호작용', '돌발성', '실패 재미', '관전 재미']],
      ['한 월드를 오래 키우기 좋은 생존 게임', '기지를 키우고 장기 저장 파일을 유지할 동기가 충분한가?', ['건설 깊이', '성장 루프', '업데이트', '장기 목표']],
      ['게임 실력 차이가 큰 친구끼리 하기 좋은 협동 게임', '숙련도 차이가 커도 한 명이 독점하거나 다른 사람이 소외되지 않는가?', ['난이도 조절', '역할 다양성', '캐리 의존도', '실패 부담']],
      ['무섭지만 겁쟁이도 친구랑 할 만한 협동 공포 게임', '공포 강도와 협동 웃음 포인트의 균형이 좋은가?', ['공포 강도', '협동 의존성', '코미디 발생', '세션 회복성']],
    ],
    votes: [
      ['가장 기억에 남는 협동 게임', '친구들과 한 협동 게임 중 가장 기억에 남는 작품은?'],
      ['생존게임 하나만 평생 한다면', '생존게임 하나만 평생 해야 한다면 무엇을 고르시겠습니까?'],
    ],
  },
  {
    familyId: 'korean-box-office', worldKey: 'movies', label: '한국 박스오피스 영화', categorySlug: 'media', subcategorySlug: 'korean-film', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Korean theatrical releases within frozen reference periods from KOBIS; title eligibility defined before scoring.',
    sourceKeys: ['kobis-yearly', 'film-official-pages'],
    contentRationale: '객관 박스오피스와 취향형 영화 추천을 한 패밀리에서 함께 만들 수 있음.',
    facts: [
      ['2026 한국 극장 관객 수 상위 영화', 'admissions', ['누적 관객 수'], '2026 YTD/final'],
      ['2026 한국 박스오피스 매출 상위 영화', 'gross', ['누적 매출'], '2026 YTD/final'],
      ['2026 한국 영화 스크린 대비 관객 효율이 높은 작품', 'admissions per eligible screen proxy', ['관객 수', '스크린 수'], '2026'],
    ],
    editorials: [
      ['극장에서 봐야 아깝지 않은 한국 영화', '큰 화면과 음향에서 체감 차이가 큰 작품은?', ['시청각 스케일', '사운드', '장면 밀도', '극장 체감']],
      ['2시간이 순식간에 가는 한국 영화', '중간 이탈감 없이 몰입이 이어지는 작품은?', ['초반 흡입력', '중반 유지', '러닝타임 체감', '전개 밀도']],
      ['데이트 영화로 실패 확률 낮은 한국 영화', '취향 차이가 있어도 함께 보기 무난한 작품은?', ['장르 접근성', '불쾌 요소', '대화거리', '러닝타임']],
      ['혼자 극장 가서 보기 좋은 한국 영화', '혼자 봤을 때 집중과 여운이 더 살아나는 작품은?', ['몰입도', '감정선', '관람 집중', '관람 후 여운']],
      ['다시 보면 더 재미있는 한국 영화', '재관람에서 새 정보나 구조가 보이는 작품은?', ['복선', '연출 디테일', '구조 재해석', '재관람 가치']],
    ],
    votes: [
      ['2026 가장 재미있었던 한국 영화', '2026년에 본 한국 영화 중 가장 재미있었던 작품은?'],
      ['결말이 가장 오래 남은 한국 영화', '결말 때문에 가장 오래 기억에 남은 한국 영화는?'],
    ],
  },
  {
    familyId: 'netflix-titles', worldKey: 'streaming-content', label: 'Netflix 한국·글로벌 콘텐츠', categorySlug: 'media', subcategorySlug: 'netflix', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Titles appearing in frozen Netflix Top 10 periods plus eligible catalog titles verified on official pages.',
    sourceKeys: ['netflix-top10', 'netflix-methodology'],
    contentRationale: '주간 화제성과 정주행·장르 취향을 연결할 수 있어 재방문성이 높음.',
    facts: [
      ['이번 주 한국 Netflix 영화 TOP 10', 'official weekly Korea film Top 10', ['주간 Top 10 순위'], 'weekly'],
      ['이번 주 한국 Netflix 시리즈 TOP 10', 'official weekly Korea TV Top 10', ['주간 Top 10 순위'], 'weekly'],
      ['Netflix 글로벌 Top 10에 오래 머문 한국 작품', 'weeks in global Top 10', ['글로벌 Top 10 진입 주수'], 'rolling/year'],
    ],
    editorials: [
      ['주말 이틀에 몰아보기 좋은 Netflix 시리즈', '주말 안에 완주 가능하면서 다음 화 유도가 강한 작품은?', ['총 러닝타임', '회차 길이', '클리프행어', '완주 부담']],
      ['1화만 보면 계속 보게 되는 Netflix 시리즈', '첫 화에서 세계관·갈등·캐릭터를 빠르게 잡는 작품은?', ['1화 흡입력', '갈등 제시', '캐릭터 훅', '다음 화 유도']],
      ['한 편이 짧아서 부담 없이 보는 Netflix 시리즈', '짧은 회차와 명확한 에피소드 만족감을 가진 작품은?', ['회차 길이', '에피소드 완결감', '진입장벽', '중단/재개 편의']],
      ['밤에 혼자 보면 더 몰입되는 Netflix 스릴러', '야간 혼자 시청에서 긴장과 몰입이 극대화되는 작품은?', ['긴장감', '사운드', '폐쇄감', '전개 속도']],
      ['가족과 같이 보기 무난한 Netflix 작품', '세대가 달라도 함께 보기 쉬운 작품은?', ['연령 접근성', '폭력/성적 요소 부담', '공감대', '대화거리']],
    ],
    votes: [
      ['요즘 Netflix에서 제일 재미있는 작품', '지금 Netflix에서 하나만 고른다면 가장 재미있는 작품은?'],
      ['다시 처음부터 정주행하고 싶은 Netflix 작품', '기억을 지우고 다시 보고 싶은 Netflix 작품은?'],
    ],
  },
  {
    familyId: 'kpop-songs', worldKey: 'music', label: 'K-pop 곡', categorySlug: 'music', subcategorySlug: 'kpop-songs', taxonomyStatus: 'PROPOSED',
    candidateUniverseStrategy: 'Songs present on manually reviewed Circle Chart snapshots and official artist releases.',
    sourceKeys: ['circle-chart', 'artist-official-pages'],
    contentRationale: '현재성·취향·투표가 강하고 곡 단위 탐색이 자연스러움.',
    facts: [
      ['이번 달 Circle 디지털 차트 상위 K-pop 곡', 'Circle digital ranking', ['디지털 차트 순위'], 'monthly'],
      ['이번 달 Circle 스트리밍 차트 상위 K-pop 곡', 'Circle streaming ranking', ['스트리밍 차트 순위'], 'monthly'],
      ['2026 Circle 글로벌 K-pop 차트 상위 곡', 'Circle global K-pop ranking', ['글로벌 K-pop 차트 순위'], '2026'],
    ],
    editorials: [
      ['운동할 때 텐션 올리기 좋은 K-pop', '운동 흐름을 끊지 않고 에너지를 올려주는 곡은?', ['템포', '후렴 에너지', '리듬 지속성', '운동 플레이리스트 적합성']],
      ['밤 드라이브에 잘 어울리는 K-pop', '야간 주행에서 분위기와 흐름이 잘 맞는 곡은?', ['분위기', '저역/리듬', '후렴 과밀도', '반복 청취']],
      ['출근길 기분 전환에 좋은 K-pop', '아침 출근길에 부담 없이 기분을 끌어올리는 곡은?', ['도입 즉시성', '밝기', '후렴 접근성', '반복성']],
      ['노래방에서 다 같이 부르기 좋은 K-pop', '여럿이 후렴을 공유하기 쉽고 분위기가 살아나는 곡은?', ['후렴 인지도', '음역 난이도', '콜앤리스폰스', '분위기 전환']],
      ['K-pop 처음 듣는 친구에게 보여주기 좋은 곡', '장르 입문자에게 K-pop의 강점을 한 곡으로 보여주기 좋은가?', ['후렴 접근성', '프로덕션', '퍼포먼스 연계', '장르 대표성']],
    ],
    votes: [
      ['2026 올해의 K-pop 한 곡', '2026 K-pop 한 곡만 남긴다면?'],
      ['첫 10초가 가장 좋은 K-pop', '인트로 10초만 듣고도 바로 끌리는 K-pop은?'],
    ],
  },
]
