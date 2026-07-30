export type ReadingScript = { id: string; title: string; text: string; targetSeconds: number };

export const minimumRecordingSeconds = 30;

/** Standardized Korean passages with varied vowels, consonant manners, and final consonants. */
export const readingScripts: ReadingScript[] = [
  {
    id: "morning",
    title: "아침의 계획",
    targetSeconds: 35,
    text: "가을 아침, 밝은 창가에서 작은 종이 울립니다. 저는 조용히 물을 마시고 부드러운 빵과 과일을 접시에 담습니다. 밖에서는 버스가 지나가고, 골목의 고양이가 천천히 걸어갑니다. 왜 외투를 입었는지 생각하며 중요한 약속과 짧은 질문을 또렷하게 말합니다. 숨을 고른 뒤 다음 문장을 자연스럽게 이어 읽습니다. 오늘의 기분은 차분하지만 새로운 일을 시작할 생각에 조금 기대됩니다.",
  },
  {
    id: "walk",
    title: "비 온 뒤 산책",
    targetSeconds: 35,
    text: "비가 그친 오후, 넓은 공원 길에는 젖은 잎과 맑은 빛이 번집니다. 저는 천천히 걷다가 벤치 옆의 작은 꽃을 바라봅니다. 파란 우산, 하얀 구름, 붉은 벽돌 건물이 서로 다른 색으로 보입니다. 친구에게 안부를 묻고, 지난주에 들었던 즐거운 음악 이야기도 꺼냅니다. 급하게 높이거나 낮추지 않고, 편한 호흡으로 끝소리까지 분명하게 읽습니다.",
  },
  {
    id: "message",
    title: "짧은 안부",
    targetSeconds: 35,
    text: "안녕하세요. 오늘도 잘 지내고 계신가요? 저는 지금 조용한 방에서 또박또박 이야기를 하고 있습니다. 책상 위에는 연필, 지갑, 휴대폰과 따뜻한 차가 놓여 있습니다. 잠깐 쉬었다가 회의 준비를 하고, 저녁에는 가족과 저녁밥을 먹을 예정입니다. 괜찮다면 내일 다시 연락해 주세요. 기쁜 소식과 어려운 질문도 서두르지 말고 편안한 목소리로 나누고 싶습니다.",
  },
];

export function hangulCoverage(text: string) {
  const initials = new Set<number>();
  const vowels = new Set<number>();
  const finals = new Set<number>();
  for (const character of text) {
    const code = character.charCodeAt(0) - 0xac00;
    if (code < 0 || code >= 11_172) continue;
    initials.add(Math.floor(code / 588));
    vowels.add(Math.floor((code % 588) / 28));
    finals.add(code % 28);
  }
  return { initials: initials.size, vowels: vowels.size, finals: finals.size };
}
