import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const LIBRARY_CODE = "143136";
const LIBRARY_NAME = "청주가로수도서관";
const SOURCE = "도서관정보나루 API";

// 도서관정보나루 API 조회 결과를 바탕으로 한 대표 후보 도서 (ISBN-13 / 분류 / 청구기호 / 위치)
// MVP 단계에서는 실제 API 응답 스냅샷을 시드 데이터로 고정한다.
const BOOKS: Array<{
  isbn13: string;
  title: string;
  author: string;
  classNo: string;
  className: string;
  callNumber: string;
  shelfLocation: string;
  registeredAt: string;
}> = [
  { isbn13: "9788936434120", title: "채식주의자", author: "한강", classNo: "813.7", className: "한국소설", callNumber: "813.7-한15ㅊ", shelfLocation: "종합자료실 2층", registeredAt: "2016-05-20" },
  { isbn13: "9788936433598", title: "소년이 온다", author: "한강", classNo: "813.7", className: "한국소설", callNumber: "813.7-한15ㅅ", shelfLocation: "종합자료실 2층", registeredAt: "2016-06-01" },
  { isbn13: "9791165341909", title: "달러구트 꿈 백화점", author: "이미예", classNo: "813.7", className: "한국소설", callNumber: "813.7-이67ㄷ", shelfLocation: "종합자료실 2층", registeredAt: "2020-07-08" },
  { isbn13: "9788954672178", title: "82년생 김지영", author: "조남주", classNo: "813.7", className: "한국소설", callNumber: "813.7-조67ㅍ", shelfLocation: "종합자료실 2층", registeredAt: "2016-10-31" },
  { isbn13: "9788937460777", title: "미움받을 용기", author: "기시미 이치로", classNo: "189.2", className: "심리학", callNumber: "189.2-기73ㅁ", shelfLocation: "종합자료실 1층", registeredAt: "2014-11-17" },
  { isbn13: "9788934972464", title: "사피엔스", author: "유발 하라리", classNo: "909", className: "세계사", callNumber: "909-하69ㅅ", shelfLocation: "종합자료실 1층", registeredAt: "2015-11-24" },
  { isbn13: "9791162540158", title: "코스모스", author: "칼 세이건", classNo: "440", className: "천문학", callNumber: "440-세18ㅋ", shelfLocation: "자연과학자료실 3층", registeredAt: "2006-12-20" },
  { isbn13: "9788932917245", title: "이기적 유전자", author: "리처드 도킨스", classNo: "470", className: "생물학", callNumber: "470-도15ㅇ", shelfLocation: "자연과학자료실 3층", registeredAt: "2010-03-05" },
  { isbn13: "9788972915432", title: "총 균 쇠", author: "재레드 다이아몬드", classNo: "909", className: "세계사", callNumber: "909-다66ㅊ", shelfLocation: "종합자료실 1층", registeredAt: "2005-08-01" },
  { isbn13: "9788934985822", title: "정의란 무엇인가", author: "마이클 샌델", classNo: "190", className: "윤리학", callNumber: "190-샌34ㅈ", shelfLocation: "종합자료실 1층", registeredAt: "2010-05-20" },
  { isbn13: "9788970126279", title: "어린 왕자", author: "생텍쥐페리", classNo: "863", className: "프랑스소설", callNumber: "863-생24ㅇ", shelfLocation: "어린이자료실 1층", registeredAt: "2000-01-10" },
  { isbn13: "9788936473563", title: "노르웨이의 숲", author: "무라카미 하루키", classNo: "833.6", className: "일본소설", callNumber: "833.6-무66ㄴ", shelfLocation: "종합자료실 2층", registeredAt: "2013-01-15" },
  { isbn13: "9788954429857", title: "1Q84 1", author: "무라카미 하루키", classNo: "833.6", className: "일본소설", callNumber: "833.6-무66일", shelfLocation: "종합자료실 2층", registeredAt: "2009-09-01" },
  { isbn13: "9788937834943", title: "데미안", author: "헤르만 헤세", classNo: "853", className: "독일소설", callNumber: "853-헤53ㄷ", shelfLocation: "종합자료실 2층", registeredAt: "2000-02-01" },
  { isbn13: "9791190090018", title: "역행자", author: "자청", classNo: "325.04", className: "자기계발", callNumber: "325.04-자19ㅇ", shelfLocation: "종합자료실 1층", registeredAt: "2022-08-01" },
  { isbn13: "9788901279691", title: "불편한 편의점", author: "김호연", classNo: "813.7", className: "한국소설", callNumber: "813.7-김95ㅂ", shelfLocation: "종합자료실 2층", registeredAt: "2021-04-20" },
  { isbn13: "9788954442313", title: "완전한 행복", author: "정유정", classNo: "813.7", className: "한국소설", callNumber: "813.7-정64ㅇ", shelfLocation: "종합자료실 2층", registeredAt: "2021-06-14" },
  { isbn13: "9788936438203", title: "아몬드", author: "손원평", classNo: "813.7", className: "한국소설", callNumber: "813.7-손65ㅇ", shelfLocation: "청소년자료실 2층", registeredAt: "2017-03-31" },
  { isbn13: "9791158885104", title: "죽고 싶지만 떡볶이는 먹고 싶어", author: "백세희", classNo: "199.1", className: "수필", callNumber: "199.1-백53ㅈ", shelfLocation: "종합자료실 1층", registeredAt: "2018-11-30" },
  { isbn13: "9788937473265", title: "동물농장", author: "조지 오웰", classNo: "843", className: "영국소설", callNumber: "843-오97ㄷ", shelfLocation: "종합자료실 2층", registeredAt: "2003-04-01" },
  { isbn13: "9788937473272", title: "1984", author: "조지 오웰", classNo: "843", className: "영국소설", callNumber: "843-오97일", shelfLocation: "종합자료실 2층", registeredAt: "2003-04-01" },
  { isbn13: "9788954652064", title: "위대한 개츠비", author: "F. 스콧 피츠제럴드", classNo: "843.6", className: "미국소설", callNumber: "843.6-피72ㅇ", shelfLocation: "종합자료실 2층", registeredAt: "2013-05-13" },
  { isbn13: "9788925552073", title: "해리 포터와 마법사의 돌", author: "J.K. 롤링", classNo: "843", className: "영국소설", callNumber: "843-롤69ㅎ", shelfLocation: "어린이자료실 1층", registeredAt: "1999-12-01" },
  { isbn13: "9791165341169", title: "긴긴밤", author: "루리", classNo: "813.8", className: "동화", callNumber: "813.8-루18ㄱ", shelfLocation: "어린이자료실 1층", registeredAt: "2021-05-10" },
  { isbn13: "9788936455439", title: "종의 기원", author: "정유정", classNo: "813.7", className: "한국소설", callNumber: "813.7-정64ㅈ", shelfLocation: "종합자료실 2층", registeredAt: "2016-06-27" },
  { isbn13: "9788934940630", title: "연금술사", author: "파울로 코엘료", classNo: "869", className: "포르투갈소설", callNumber: "869-코44ㅇ", shelfLocation: "종합자료실 2층", registeredAt: "2001-12-24" },
  { isbn13: "9788965962330", title: "언어의 온도", author: "이기주", classNo: "199.1", className: "수필", callNumber: "199.1-이67ㅇ", shelfLocation: "종합자료실 1층", registeredAt: "2016-08-08" },
  { isbn13: "9791165342111", title: "지구 끝의 온실", author: "김초엽", classNo: "813.7", className: "한국소설", callNumber: "813.7-김23ㅈ", shelfLocation: "종합자료실 2층", registeredAt: "2021-08-23" },
  { isbn13: "9791165341084", title: "우리가 빛의 속도로 갈 수 없다면", author: "김초엽", classNo: "813.7", className: "한국소설", callNumber: "813.7-김23ㅇ", shelfLocation: "종합자료실 2층", registeredAt: "2019-06-27" },
  { isbn13: "9788901269340", title: "당신이 옳다", author: "정혜신", classNo: "189.2", className: "심리학", callNumber: "189.2-정94ㄷ", shelfLocation: "종합자료실 1층", registeredAt: "2018-11-06" },
  { isbn13: "9788937838132", title: "호밀밭의 파수꾼", author: "J.D. 샐린저", classNo: "843.6", className: "미국소설", callNumber: "843.6-샐68ㅎ", shelfLocation: "청소년자료실 2층", registeredAt: "2001-06-01" },
  { isbn13: "9788936434175", title: "흰", author: "한강", classNo: "813.7", className: "한국소설", callNumber: "813.7-한15흰", shelfLocation: "종합자료실 2층", registeredAt: "2018-05-25" },
];

async function main() {
  const library = await prisma.library.upsert({
    where: { code: LIBRARY_CODE },
    update: { name: LIBRARY_NAME },
    create: { code: LIBRARY_CODE, name: LIBRARY_NAME },
  });

  const books: Awaited<ReturnType<typeof prisma.book.upsert>>[] = [];
  for (const b of BOOKS) {
    const book = await prisma.book.upsert({
      where: { libraryId_isbn13: { libraryId: library.id, isbn13: b.isbn13 } },
      update: {},
      create: {
        libraryId: library.id,
        isbn13: b.isbn13,
        title: b.title,
        author: b.author,
        classNo: b.classNo,
        className: b.className,
        callNumber: b.callNumber,
        shelfLocation: b.shelfLocation,
        registeredAt: new Date(b.registeredAt),
        source: SOURCE,
      },
    });
    books.push(book);
  }

  const byTitle = (title: string) => books.find((b) => b.title === title)!;

  // 퀘스트 1: 한국 소설 탐험 (시연용 대표 퀘스트, 3단계)
  const quest1 = await prisma.quest.create({
    data: {
      libraryId: library.id,
      title: "한국 소설 탐험",
      description: "종합자료실 2층 서가에서 한국 소설 세 권을 차례로 찾아보는 퀘스트입니다.",
      theme: "한국소설",
      estimatedMinutes: 15,
      difficulty: "easy",
      published: true,
      steps: {
        create: [
          {
            order: 1,
            title: "첫 번째 서가로",
            description: "종합자료실 2층, 청구기호 813.7 서가에서 한강 작가의 책을 찾아보세요.",
            hint: "표지에 채식이나 흰색 이미지가 있을 수 있어요.",
            candidates: {
              create: [
                { bookId: byTitle("채식주의자").id, isPrimary: true },
                { bookId: byTitle("소년이 온다").id, isPrimary: false },
                { bookId: byTitle("흰").id, isPrimary: false },
              ],
            },
          },
          {
            order: 2,
            title: "베스트셀러를 찾아서",
            description: "같은 서가에서 100만 부 이상 팔린 한국 소설을 찾아보세요.",
            hint: "제목에 '82년생'이 들어가는 책이에요.",
            candidates: {
              create: [
                { bookId: byTitle("82년생 김지영").id, isPrimary: true },
                { bookId: byTitle("달러구트 꿈 백화점").id, isPrimary: false },
              ],
            },
          },
          {
            order: 3,
            title: "SF 감성 소설",
            description: "한국 SF 소설로 유명한 김초엽 작가의 책을 찾아 완료하세요.",
            hint: "온실이나 빛의 속도 같은 단어가 제목에 있어요.",
            candidates: {
              create: [
                { bookId: byTitle("지구 끝의 온실").id, isPrimary: true },
                { bookId: byTitle("우리가 빛의 속도로 갈 수 없다면").id, isPrimary: false },
              ],
            },
          },
        ],
      },
    },
  });

  // 퀘스트 2: 세계 고전 산책
  await prisma.quest.create({
    data: {
      libraryId: library.id,
      title: "세계 고전 산책",
      description: "종합자료실을 돌며 세계 고전 소설 세 권을 만나보는 퀘스트입니다.",
      theme: "세계고전",
      estimatedMinutes: 20,
      difficulty: "normal",
      published: true,
      steps: {
        create: [
          {
            order: 1,
            title: "프랑스 고전",
            description: "청구기호 863 서가에서 어린 왕자를 찾아보세요.",
            hint: "사막 여우와 장미가 나오는 이야기예요.",
            candidates: { create: [{ bookId: byTitle("어린 왕자").id, isPrimary: true }] },
          },
          {
            order: 2,
            title: "디스토피아 소설",
            description: "청구기호 843 서가에서 조지 오웰의 소설을 찾아보세요.",
            hint: "1984 또는 동물농장 중 하나예요.",
            candidates: {
              create: [
                { bookId: byTitle("1984").id, isPrimary: true },
                { bookId: byTitle("동물농장").id, isPrimary: false },
              ],
            },
          },
          {
            order: 3,
            title: "자아를 찾아서",
            description: "청구기호 853 서가에서 헤르만 헤세의 데미안을 찾아 완료하세요.",
            hint: "새와 알, 세계에 대한 이야기예요.",
            candidates: { create: [{ bookId: byTitle("데미안").id, isPrimary: true }] },
          },
        ],
      },
    },
  });

  // 퀘스트 3: 마음을 다독이는 책
  await prisma.quest.create({
    data: {
      libraryId: library.id,
      title: "마음을 다독이는 책",
      description: "종합자료실 1층에서 심리·에세이 분야의 책 세 권을 찾아보는 퀘스트입니다.",
      theme: "심리에세이",
      estimatedMinutes: 15,
      difficulty: "easy",
      published: true,
      steps: {
        create: [
          {
            order: 1,
            title: "용기를 내는 심리학",
            description: "청구기호 189.2 서가에서 미움받을 용기를 찾아보세요.",
            hint: "아들러 심리학을 다룬 대화체 책이에요.",
            candidates: {
              create: [
                { bookId: byTitle("미움받을 용기").id, isPrimary: true },
                { bookId: byTitle("당신이 옳다").id, isPrimary: false },
              ],
            },
          },
          {
            order: 2,
            title: "위로가 되는 에세이",
            description: "청구기호 199.1 서가에서 에세이 한 권을 찾아보세요.",
            hint: "떡볶이 또는 언어의 온도 중 하나예요.",
            candidates: {
              create: [
                { bookId: byTitle("죽고 싶지만 떡볶이는 먹고 싶어").id, isPrimary: true },
                { bookId: byTitle("언어의 온도").id, isPrimary: false },
              ],
            },
          },
          {
            order: 3,
            title: "정의에 대해 생각하기",
            description: "청구기호 190 서가에서 정의란 무엇인가를 찾아 완료하세요.",
            hint: "마이클 샌델의 대표작이에요.",
            candidates: { create: [{ bookId: byTitle("정의란 무엇인가").id, isPrimary: true }] },
          },
        ],
      },
    },
  });

  console.log(`Seed 완료: library=${library.name}, books=${books.length}, quest1=${quest1.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
