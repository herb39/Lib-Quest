import { getDataSourceInfo } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

// 실제 수집 당시(2026-08-19) 기록. Data4Library itemSrch는 등록 기간 기준 조회이며
// 이 값들은 수집 이력이므로 코드/DB가 아닌 문서로 고정해 둔다 (재수집 시 함께 갱신).
const COLLECTION = {
  apiName: "도서관 정보나루(Data4Library) itemSrch",
  startDt: "2026-06-01",
  endDt: "2026-08-19",
  rawCount: 300,
  curatedCount: 36,
  fields: [
    "ISBN13",
    "제목",
    "저자",
    "KDC 분류번호/분류명",
    "청구기호",
    "자료실/서가 위치",
    "등록일",
  ],
};

export default async function DataSourcePage() {
  const info = await getDataSourceInfo();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8">
      <h1 className="text-xl font-bold">데이터 출처</h1>
      <p className="mt-1 text-sm text-slate-500">
        Lib Quest가 사용하는 도서 데이터가 어디서 왔는지 설명합니다.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">활용 데이터</p>
        <p className="mt-1 font-semibold">{COLLECTION.apiName}</p>
        {info.available ? (
          <p className="mt-1 text-sm text-slate-500">
            대표 도서관: {info.library.name} (libCode {info.library.code})
          </p>
        ) : (
          <p className="mt-1 text-sm text-amber-600">DB 연결이 없어 현재 도서관 정보를 표시할 수 없습니다.</p>
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">수집 정보</p>
        <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-400">수집 API</dt>
          <dd>itemSrch</dd>
          <dt className="text-slate-400">수집 기간</dt>
          <dd>
            {COLLECTION.startDt} ~ {COLLECTION.endDt}
          </dd>
          <dt className="text-slate-400">원본 조회 건수</dt>
          <dd>{COLLECTION.rawCount}건</dd>
          <dt className="text-slate-400">발표용 큐레이션 도서</dt>
          <dd>{COLLECTION.curatedCount}권</dd>
          {info.available && (
            <>
              <dt className="text-slate-400">현재 DB 도서 수</dt>
              <dd>{info.bookCount}권</dd>
              <dt className="text-slate-400">현재 DB 퀘스트 수</dt>
              <dd>{info.questCount}개</dd>
            </>
          )}
        </dl>
      </section>

      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">수집된 필드</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {COLLECTION.fields.map((f) => (
            <li key={f} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <ul className="list-disc space-y-1 pl-4">
          <li>Data4Library API는 로컬에서 데이터를 사전에 수집할 때만 사용합니다.</li>
          <li>지금 이 화면과 퀘스트는 실시간으로 Data4Library를 호출하지 않고, Neon DB에 저장된 검증된 데이터만 조회합니다.</li>
          <li>등록일 기준 조회 결과이며, 실시간 대출 가능 여부를 의미하지 않습니다.</li>
        </ul>
      </section>
    </main>
  );
}
