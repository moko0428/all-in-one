'use client';

import { useState } from 'react';
import { DATA } from '@/data/data';

export default function Home() {
  const [quantities, setQuantities] = useState<number[]>(() =>
    DATA.map(() => 0)
  );

  type Snapshot = {
    id: number;
    totalQuantity: number;
    totalPrice: number;
    quantities: number[];
    createdAt: string;
  };

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | null>(
    null
  );

  const [cumulativeQuantities, setCumulativeQuantities] = useState<number[]>(
    () => {
      if (typeof window === 'undefined') return DATA.map(() => 0);
      try {
        const raw = window.localStorage.getItem('todaySalesSummary');
        if (!raw) return DATA.map(() => 0);
        const parsed: { quantities?: number[] } = JSON.parse(raw);
        if (
          !parsed.quantities ||
          !Array.isArray(parsed.quantities) ||
          parsed.quantities.length !== DATA.length
        ) {
          return DATA.map(() => 0);
        }
        return parsed.quantities;
      } catch {
        return DATA.map(() => 0);
      }
    }
  );

  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('todaySalesSummary');
      if (!raw) return [];
      const parsed: {
        quantities?: number[];
        updatedAt?: string;
        snapshots?: Snapshot[];
      } = JSON.parse(raw);

      // 건별 스냅샷이 있으면 복원
      if (parsed.snapshots && Array.isArray(parsed.snapshots)) {
        return parsed.snapshots;
      }

      // 스냅샷이 없으면 누적값으로 요약 카드만 생성 (하위 호환성)
      if (
        !parsed.quantities ||
        !Array.isArray(parsed.quantities) ||
        parsed.quantities.length !== DATA.length
      ) {
        return [];
      }

      const safeQuantities = parsed.quantities;
      const restoredTotalQuantity = safeQuantities.reduce(
        (sum, q) => sum + q,
        0
      );
      const restoredTotalPrice = safeQuantities.reduce(
        (sum, q, index) => sum + q * DATA[index].price,
        0
      );

      return [
        {
          id: parsed.updatedAt
            ? Date.parse(parsed.updatedAt) || Date.now()
            : Date.now(),
          totalQuantity: restoredTotalQuantity,
          totalPrice: restoredTotalPrice,
          quantities: safeQuantities,
          createdAt: parsed.updatedAt
            ? new Date(parsed.updatedAt).toLocaleTimeString()
            : '',
        },
      ];
    } catch {
      return [];
    }
  });

  const handleQuantityChange = (index: number, nextValue: number) => {
    const value = Math.max(
      0,
      Math.floor(Number.isNaN(nextValue) ? 0 : nextValue)
    );
    setQuantities((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);
  const totalPrice = quantities.reduce(
    (sum, q, index) => sum + q * DATA[index].price,
    0
  );

  const handleReset = () => {
    // 화면의 현재 입력값, 누적 데이터, 요약 카드 모두 초기화
    setQuantities(() => DATA.map(() => 0));
    setCumulativeQuantities(() => DATA.map(() => 0));
    setSnapshots([]);
    setEditingSnapshotId(null);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('todaySalesSummary');
    }
  };

  const handleConfirm = () => {
    if (totalQuantity === 0) return;

    const now = new Date();
    const nextCumulative = cumulativeQuantities.map(
      (prev, index) => prev + (quantities[index] ?? 0)
    );

    const cumulativeTotalQuantity = nextCumulative.reduce(
      (sum, q) => sum + q,
      0
    );
    const cumulativeTotalPrice = nextCumulative.reduce(
      (sum, q, index) => sum + q * DATA[index].price,
      0
    );

    // 건별 스냅샷은 해당 시점의 입력값만 저장 (누적 아님)
    const snapshot: Snapshot = {
      id: now.getTime(),
      totalQuantity: totalQuantity, // 현재 입력값의 총 개수
      totalPrice: totalPrice, // 현재 입력값의 총 가격
      quantities: [...quantities], // 현재 입력값 복사
      createdAt: now.toLocaleTimeString(),
    };

    const nextSnapshots: Snapshot[] = [snapshot, ...snapshots];

    setSnapshots(nextSnapshots);
    setCumulativeQuantities(nextCumulative);

    // 로컬스토리지에 누적 금액 및 상품 수량, 건별 스냅샷 저장
    if (typeof window !== 'undefined') {
      const payload = {
        totalQuantity: cumulativeTotalQuantity,
        totalPrice: cumulativeTotalPrice,
        quantities: nextCumulative,
        updatedAt: now.toISOString(),
        snapshots: nextSnapshots, // 건별 스냅샷도 함께 저장
      };

      window.localStorage.setItem('todaySalesSummary', JSON.stringify(payload));
    }

    // 확인 후 현재 입력값 초기화
    setQuantities(() => DATA.map(() => 0));
  };

  const handleDeleteSnapshot = (id: number) => {
    const target = snapshots.find((snap) => snap.id === id);
    if (!target) return;

    const nextSnapshots = snapshots.filter((snap) => snap.id !== id);

    const nextCumulative = cumulativeQuantities.map(
      (value, index) => value - (target.quantities[index] ?? 0)
    );

    setSnapshots(nextSnapshots);
    setCumulativeQuantities(nextCumulative);

    if (editingSnapshotId === id) {
      setEditingSnapshotId(null);
      setQuantities(() => DATA.map(() => 0));
    }

    if (typeof window !== 'undefined') {
      const cumulativeTotalQuantity = nextCumulative.reduce(
        (sum, q) => sum + q,
        0
      );
      const cumulativeTotalPrice = nextCumulative.reduce(
        (sum, q, index) => sum + q * DATA[index].price,
        0
      );

      const payload = {
        totalQuantity: cumulativeTotalQuantity,
        totalPrice: cumulativeTotalPrice,
        quantities: nextCumulative,
        updatedAt: new Date().toISOString(),
        snapshots: nextSnapshots,
      };

      window.localStorage.setItem('todaySalesSummary', JSON.stringify(payload));
    }
  };

  const handleFullSet = () => {
    setQuantities((prev) => prev.map((q) => q + 1));
  };
  const handleSelectSnapshot = (id: number) => {
    // 이미 선택된 항목을 다시 누르면 선택 해제
    if (editingSnapshotId === id) {
      setEditingSnapshotId(null);
      setQuantities(() => DATA.map(() => 0));
      return;
    }

    const target = snapshots.find((snap) => snap.id === id);
    if (!target) return;

    setQuantities([...target.quantities]);
    setEditingSnapshotId(id);
  };

  const handleUpdateSnapshot = () => {
    if (editingSnapshotId === null) return;

    const targetIndex = snapshots.findIndex(
      (snap) => snap.id === editingSnapshotId
    );
    if (targetIndex === -1) return;

    const oldSnapshot = snapshots[targetIndex];

    const nextQuantities = [...quantities];
    const nextTotalQuantity = nextQuantities.reduce((sum, q) => sum + q, 0);
    const nextTotalPrice = nextQuantities.reduce(
      (sum, q, index) => sum + q * DATA[index].price,
      0
    );

    // 누적값은 (새 수량 - 기존 수량) 만큼 반영
    const nextCumulative = cumulativeQuantities.map((value, index) => {
      const diff =
        (nextQuantities[index] ?? 0) - (oldSnapshot.quantities[index] ?? 0);
      return value + diff;
    });

    const updatedSnapshot: Snapshot = {
      ...oldSnapshot,
      totalQuantity: nextTotalQuantity,
      totalPrice: nextTotalPrice,
      quantities: nextQuantities,
      createdAt: new Date().toLocaleTimeString(),
    };

    const nextSnapshots = snapshots.map((snap) =>
      snap.id === editingSnapshotId ? updatedSnapshot : snap
    );

    setSnapshots(nextSnapshots);
    setCumulativeQuantities(nextCumulative);
    setEditingSnapshotId(null);
    setQuantities(() => DATA.map(() => 0));

    if (typeof window !== 'undefined') {
      const cumulativeTotalQuantity = nextCumulative.reduce(
        (sum, q) => sum + q,
        0
      );
      const cumulativeTotalPrice = nextCumulative.reduce(
        (sum, q, index) => sum + q * DATA[index].price,
        0
      );

      const payload = {
        totalQuantity: cumulativeTotalQuantity,
        totalPrice: cumulativeTotalPrice,
        quantities: nextCumulative,
        updatedAt: new Date().toISOString(),
        snapshots: nextSnapshots,
      };

      window.localStorage.setItem('todaySalesSummary', JSON.stringify(payload));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-1 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">굿즈 수량 입력</h1>
        <button
          type="button"
          onClick={() => setIsResetModalOpen(true)}
          className="px-4 py-2 rounded border text-sm md:text-base"
        >
          초기화
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 items-stretch">
        {/* 왼쪽: 굿즈 수량 입력 */}
        <div className="col-span-2 space-y-4 h-[600px] bg-white shadow-md p-4 rounded-md border">
          <div className="grid grid-cols-4 font-semibold border-b pb-2 text-sm md:text-base">
            <div>상품명</div>
            <div className="text-right">가격</div>
            <div className="text-center">수량</div>
            <div className="text-right">금액</div>
          </div>

          {DATA.map((item, index) => {
            const quantity = quantities[index] ?? 0;
            const lineTotal = quantity * item.price;

            return (
              <div
                key={item.name}
                className="grid grid-cols-4 items-center py-2 border-b last:border-b-0 text-sm md:text-base gap-2"
              >
                <div
                  className={
                    quantity > 0
                      ? 'bg-red-500 text-white rounded px-2 py-0.5'
                      : ''
                  }
                >
                  {item.name}
                </div>
                <div className="text-right">
                  {item.price.toLocaleString()}원
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 border rounded text-sm"
                    onClick={() => handleQuantityChange(index, quantity - 1)}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    className="w-16 border rounded px-2 py-1 text-center"
                    value={quantity}
                    onChange={(e) =>
                      handleQuantityChange(index, Number(e.target.value))
                    }
                  />
                  <button
                    type="button"
                    className="px-2 py-1 border rounded text-sm"
                    onClick={() => handleQuantityChange(index, quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <div className="text-right">{lineTotal.toLocaleString()}원</div>
              </div>
            );
          })}

          <div className="grid grid-cols-4 items-center font-semibold pt-4 border-t mt-4 text-sm md:text-base gap-2">
            <div className="col-span-2 text-right">현재 합계</div>
            <div className="text-center">
              총 {totalQuantity.toLocaleString()}개
            </div>
            <div className="text-right">{totalPrice.toLocaleString()}원</div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleFullSet}
              className="mt-2 px-3 py-2 rounded border text-xs md:text-sm"
            >
              풀세트
            </button>
            <button
              type="button"
              onClick={
                editingSnapshotId === null
                  ? handleConfirm
                  : handleUpdateSnapshot
              }
              className="mt-2 px-4 py-2 rounded bg-blue-600 text-white text-sm md:text-base disabled:opacity-40"
              disabled={totalQuantity === 0}
            >
              {editingSnapshotId === null ? '입력' : '수정하기'}
            </button>
          </div>
        </div>

        {/* 오른쪽: 건별 스냅샷 */}
        <div className="col-span-1 flex flex-col h-[600px] bg-white shadow-md p-4 rounded-md border">
          {snapshots.length > 0 ? (
            <>
              <h2 className="text-sm font-semibold border-b pb-2 mb-4">
                건별 스냅샷
              </h2>
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {snapshots.map((snap, index) => (
                  <div
                    key={snap.id}
                    className={`border rounded-md p-3 bg-white space-y-1 text-xs md:text-sm cursor-pointer ${
                      editingSnapshotId === snap.id
                        ? 'border-blue-500 ring-1 ring-blue-300'
                        : ''
                    }`}
                    onClick={() => handleSelectSnapshot(snap.id)}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="truncate">
                        {snapshots.length - index}회 · {snap.createdAt}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span>{snap.totalPrice.toLocaleString()}원</span>
                        <button
                          type="button"
                          className="px-2 py-0.5 border rounded text-[11px] text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSnapshot(snap.id);
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {snap.quantities.map((q, i) =>
                        q > 0 ? (
                          <span
                            key={`${snap.id}-item-${DATA[i].name}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 border"
                          >
                            {DATA[i].name} × {q}
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-gray-400 text-sm text-center">
                건별 스냅샷이 없습니다
              </div>
            </div>
          )}
        </div>
      </div>

      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm space-y-4">
            <p className="text-sm md:text-base">
              정말로 초기화 하시겠습니까?
              <br />
              (누적된 금액과 수량이 모두 삭제됩니다)
            </p>
            <div className="flex justify-end gap-2 text-sm md:text-base">
              <button
                type="button"
                className="px-4 py-2 rounded border"
                onClick={() => setIsResetModalOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-red-600 text-white"
                onClick={() => {
                  handleReset();
                  setIsResetModalOpen(false);
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {(cumulativeQuantities.some((q) => q > 0) || snapshots.length > 0) && (
        <div className="mt-6 border-t pt-4 space-y-3">
          <h2 className="text-lg font-semibold">오늘 판매 요약</h2>
          <div className="space-y-3 text-sm md:text-base">
            {(() => {
              const cumulativeTotalQuantity = cumulativeQuantities.reduce(
                (sum, q) => sum + q,
                0
              );
              const cumulativeTotalPrice = cumulativeQuantities.reduce(
                (sum, q, index) => sum + q * DATA[index].price,
                0
              );

              if (cumulativeTotalQuantity === 0) return null;

              return (
                <div className="border rounded-md p-3 space-y-2 bg-gray-50">
                  <div className="flex justify-between font-semibold">
                    <span>누적</span>
                    <span>{cumulativeTotalPrice.toLocaleString()}원</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {cumulativeQuantities.map((q, i) =>
                      q > 0 ? (
                        <span
                          key={`cumulative-${DATA[i].name}`}
                          className="inline-flex items-center px-2 py-1 rounded-full bg-white border text-xs md:text-sm"
                        >
                          {DATA[i].name} × {q}
                        </span>
                      ) : null
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
