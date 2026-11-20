/** 표현: sentence patterns to learn as set phrases, grouped into tables. */

export interface PatternRow {
  ko: string;
  ja: string;
  /** Hangul pronunciation, written by hand. */
  sound: string;
  /** What the pattern is for (부탁, 확인 …), only in tables that have the column. */
  use?: string;
}

export interface PatternTable {
  id: string;
  title: string;
  /** Heading of the Korean column. */
  koLabel: string;
  rows: PatternRow[];
}

const row = (ko: string, ja: string, sound: string, use?: string): PatternRow => ({ ko, ja, sound, use });

export const PATTERN_TABLES: PatternTable[] = [
  {
    id: 'common',
    title: '말끝만 바꾸면 되는 기본 패턴 20',
    koLabel: '표현',
    rows: [
      row('~했어', '～した', '시타'),
      row('~하고 있어', '～してる', '시테루'),
      row('~하고 있었어', '～してた', '시테타'),
      row('~할 거야', '～する', '스루'),
      row('~하고 싶어', '～したい', '시타이'),
      row('~하고 싶지 않아', '～したくない', '시타쿠나이'),
      row('~해야 해', '～しなきゃ', '시나캬'),
      row('~하지 않아도 돼', '～しなくてもいい', '시나쿠테모 이이'),
      row('~해도 돼?', '～してもいい？', '시테모 이이?'),
      row('~하지 마', '～しないで', '시나이데'),
      row('~해 줘', '～して', '시테'),
      row('~해 줄래?', '～してくれる？', '시테쿠레루?'),
      row('~해 볼게', '～してみる', '시테미루'),
      row('~해 봤어', '～したことある', '시타 코토 아루'),
      row('~한 적 없어', '～したことない', '시타 코토 나이'),
      row('~할 수 있어', '～できる', '데키루'),
      row('~할 수 없어', '～できない', '데키나이'),
      row('~하는 중이야', '～してるところ', '시테루 토코로'),
      row('~할 생각이야', '～するつもり', '스루 츠모리'),
      row('~하는 게 좋아', '～したほうがいい', '시타 호오가 이이'),
    ],
  },
  {
    id: 'ask',
    title: '부탁·질문·확인하기',
    koLabel: '패턴',
    rows: [
      row('~해 줘', '～して', '시테', '부탁'),
      row('~해 줄래?', '～してくれる？', '시테쿠레루?', '부탁·질문'),
      row('~해 줄 수 있어?', '～してもらえる？', '시테모라에루?', '정중한 부탁'),
      row('~해도 괜찮아?', '～してもだいじょうぶ？', '시테모 다이죠오부?', '확인'),
      row('~하면 어떨까?', '～したらどう？', '시타라 도오?', '제안'),
      row('~하는 게 좋아', '～したほうがいい', '시타 호오가 이이', '조언'),
      row('~하지 마', '～しないで', '시나이데', '금지·부탁'),
      row('~하지 말아 줘', '～しないでほしい', '시나이데 호시이', '요청'),
    ],
  },
  {
    id: 'friends',
    title: '대화가 술술 이어지는 한마디',
    koLabel: '한국어',
    rows: [
      row('그런 것 같아', 'そうだとおもう', '소오다토 오모우'),
      row('그런 것 같지 않아', 'そうはおもわない', '소오와 오모와나이'),
      row('그럴 수도 있어', 'そうかもしれない', '소오카모 시레나이'),
      row('그런 줄 알았어', 'そうだとおもってた', '소오다토 오못테타'),
      row('그럴 줄 몰랐어', 'そうだとおもわなかった', '소오다토 오모와나캇타'),
      row('어떻게 해야 해?', 'どうすればいい？', '도오 스레바 이이?'),
      row('어떻게 생각해?', 'どうおもう？', '도오 오모우?'),
      row('왜 그렇게 생각해?', 'なんでそうおもう？', '난데 소오 오모우?'),
      row('무슨 뜻이야?', 'どういういみ？', '도오이우 이미?'),
      row('다시 말해 줘', 'もういっかいいって', '모오 잇카이 잇테'),
      row('이해했어', 'わかった', '와캇타'),
      row('이해 못 했어', 'わからなかった', '와카라나캇타'),
      row('기억하고 있어', 'おぼえてる', '오보에테루'),
      row('잊어버렸어', 'わすれちゃった', '와스레챳타'),
    ],
  },
];

/** What to read aloud: the pattern without its ～ and question mark. */
export function spokenPattern(ja: string): string {
  return ja.replace(/[～~？?]/g, '');
}
